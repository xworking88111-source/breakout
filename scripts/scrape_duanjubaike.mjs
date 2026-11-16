#!/usr/bin/env node
/**
 * 從公開短劇目錄（duanjubaike.org）的「列表 + 詳情」頁，擴充短劇清單。
 * Expand the short-drama catalogue from the public directory duanjubaike.org.
 *
 * 合規說明 / Compliance:
 *   - robots.txt 只禁止 /search 與 /auth，列表與詳情頁允許抓取。
 *   - 低頻（每頁 0.7 秒）、只取事實欄位（劇名、上線日、集數、熱度、版權方、簡介），
 *     不轉載圖片或全文；每筆保留來源連結。
 *   - Low frequency (0.7s/page), factual fields only, source link kept per record.
 *
 * 用法 / Usage: node scripts/scrape_duanjubaike.mjs
 * 輸出 / Output: scripts/seed/incoming/directory.tsv（TSV，6 欄）
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'scripts/seed/incoming/directory.tsv')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】]/g, '')

const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const YEAR_RE = /20(2[3-6])-(\d{2})-(\d{2})/

// 以關鍵詞推斷題材（標題＋簡介）/ keyword-based genre inference
const GENRE_RULES = [
  ['穿越', ['穿越', '穿回', '回到', '重生']],
  ['重生', ['重生', '重活']],
  ['甜寵', ['甜宠', '甜妻', '宠上天', '撒糖', '娇妻']],
  ['逆襲', ['逆袭', '打脸', '崛起', '翻身', '战神', '归来']],
  ['贅婿', ['赘婿', '上门女婿']],
  ['真假千金', ['真假千金', '真千金', '假千金']],
  ['懸疑', ['悬疑', '凶手', '案', '谜', '真相']],
  ['復仇', ['复仇', '报仇', '清算']],
  ['家庭', ['家庭', '妈妈', '爸爸', '婆婆', '全家', '亲情']],
  ['年代', ['年代', '八零', '七零', '九零', '1980', '1990']],
  ['古裝', ['古装', '王爷', '侯府', '公主', '皇上', '将军', '皇后', '太子']],
  ['民國', ['民国', '军阀', '督军', '少帅']],
  ['都市', ['都市', '总裁', '豪门', '职场', '公司']],
  ['萌寶', ['萌宝', '宝宝', '崽', '奶娃', '三胞胎', '四宝']],
  ['銀髮', ['老太', '爷爷', '奶奶', '黄昏恋', '银发']],
  ['校園', ['校园', '同桌', '学长', '青春']],
  ['玄幻', ['玄幻', '修仙', '仙尊', '魔界', '灵气', '灵根']],
  ['仙俠', ['仙侠', '飞升', '修真']],
  ['武俠', ['武侠', '江湖', '剑客']],
  ['體育', ['体育', '球队', '球神', '拳']],
  ['喜劇', ['喜剧', '搞笑', '沙雕']],
  ['女性成長', ['女性', '事业', '离婚后', '独立']],
  ['商戰', ['商战', '股权', '公司']],
  ['諜戰', ['谍战', '卧底', '特工']],
  ['無限流', ['无限流', '副本', '规则怪谈']],
  ['種田', ['种田', '荒年', '村里', '致富']],
  ['醫療', ['医生', '医术', '医院', '手术']],
  ['律政', ['律师', '法庭', '法官']],
  ['軍旅', ['军旅', '特种兵', '军营']],
  ['非遺', ['非遗', '传承', '手艺']],
  ['文旅', ['文旅', '旅游', '古城']],
  ['音樂', ['音乐', '歌手', '乐队']],
  ['美食', ['美食', '厨', '餐厅']],
  ['科幻', ['科幻', '外星', '未来世界']],
  ['恐怖', ['恐怖', '灵异', '鬼']],
]

function inferGenres(title, intro) {
  const text = `${title} ${intro}`
  const out = []
  for (const [g, keys] of GENRE_RULES) {
    if (keys.some((k) => text.includes(k))) out.push(g)
    if (out.length >= 2) break
  }
  return out.length ? out : ['其他']
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

// 讀取目前資料集，避免重複 / load current dataset to skip existing titles
let existing = new Set()
try {
  const data = JSON.parse(await fs.readFile(path.join(ROOT, 'app/public/data/works.json'), 'utf8'))
  existing = new Set(data.works.map((w) => norm(w.title.zh)))
} catch {
  /* first run */
}

const rows = []
const seen = new Set()
for (let page = 1; page <= 10; page++) {
  let html
  try {
    html = await get(`https://duanjubaike.org/zh-Hans/drama/list?page=${page}`)
  } catch {
    break
  }
  const cards = [
    ...html.matchAll(/href="https:\/\/duanjubaike\.org\/zh-Hans\/drama\/(\d+)"[^>]*>\s*<img[^>]*alt="([^"]+)"/g),
  ].map((m) => ({ id: m[1], title: m[2] }))
  const uniqueCards = [...new Map(cards.map((c) => [c.id, c])).values()]
  console.log(`page ${page}: ${uniqueCards.length} cards`)

  for (const card of uniqueCards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    const key = norm(card.title)
    if (existing.has(key)) continue
    try {
      const detail = await get(`https://duanjubaike.org/zh-Hans/drama/${card.id}`)
      const yearMatch = detail.match(YEAR_RE)
      if (!yearMatch) continue
      const year = 2000 + Number(yearMatch[1]) // 2026-09-02 → 2026
      const introMatch = detail.match(/剧情简介<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/)
      const intro = strip(introMatch?.[1] ?? '')
      const owner = detail.match(/版权方[：:]\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/)
      const ownerText = strip(owner?.[1] ?? '') || '未查證'
      const genres = inferGenres(card.title, intro)
      const fact = `目錄收錄｜上線 ${yearMatch[0]}${ownerText !== '未查證' ? `｜版權方 ${ownerText}` : ''}`
      rows.push({
        year,
        title: card.title,
        platform: ownerText,
        genres,
        url: `https://duanjubaike.org/zh-Hans/drama/${card.id}`,
        fact,
      })
      existing.add(key)
    } catch {
      /* skip broken detail */
    }
    await sleep(650)
  }
  if (rows.length >= 200) break
  await sleep(500)
}

const tsv = rows.map((r) => [r.year, r.title, r.platform, r.genres.join(','), r.url, r.fact].join('\t')).join('\n')
await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, tsv, 'utf8')
console.log(`✅ wrote ${rows.length} rows → scripts/seed/incoming/directory.tsv`)
const byYear = rows.reduce((m, r) => ((m[r.year] = (m[r.year] ?? 0) + 1), m), {})
console.log('   by year:', byYear)
