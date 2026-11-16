#!/usr/bin/env node
/**
 * 從已建立的目錄索引，補入「有作品專屬頁面」的新短劇，確保通過逐筆驗證。
 * Add new short dramas that already have a per-title page, so they pass verification.
 *
 * 用法 / Usage: node scripts/fill_verified_shortdrama.mjs [target]
 * 輸出 / Output: scripts/seed/incoming/directory-fill.tsv
 */
import fs from 'node:fs/promises'
import * as OpenCC from 'opencc-js'
const TARGET = Number(process.argv[2] ?? 320)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const toCN = OpenCC.Converter({ from: 'tw', to: 'cn' })
const norm = (s) => toCN(String(s)).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')
const strip = (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const data = JSON.parse(await fs.readFile('app/public/data/works.json', 'utf8'))
const existing = new Set(data.works.map((w) => `${w.medium}:${norm(w.title.zh)}`))
const index = JSON.parse(await fs.readFile('data/directory-index.json', 'utf8')).byTitle
// 索引順序：先 org（新）再 net 第 1→2000 頁（新→舊）。
// 取中段位置，對應 2024–2025 作品，避免只補 2026。
// Index order: recent first, then newest→oldest; a middle slice maps to 2024–2025.
const all = Object.entries(index).filter(([k]) => !existing.has(`shortdrama:${k}`))
const candidates = all.slice(6000, 40000)

const GENRES = [
  ['穿越', ['穿越', '穿回', '回到']],['重生', ['重生', '重活']],['甜寵', ['甜宠', '甜妻', '宠上天', '娇妻']],
  ['逆襲', ['逆袭', '打脸', '战神', '归来']],['贅婿', ['赘婿', '上门女婿']],['真假千金', ['真假千金', '真千金', '假千金']],
  ['懸疑', ['悬疑', '凶手', '谜', '真相']],['復仇', ['复仇', '报仇']],['家庭', ['家庭', '妈妈', '爸爸', '婆婆', '全家']],
  ['年代', ['年代', '八零', '七零', '九零']],['古裝', ['古装', '王爷', '侯府', '公主', '皇上', '将军', '皇后']],
  ['民國', ['民国', '军阀', '督军', '少帅']],['都市', ['都市', '总裁', '豪门', '公司']],['萌寶', ['萌宝', '宝宝', '崽', '奶娃']],
  ['銀髮', ['老太', '爷爷', '奶奶', '黄昏恋']],['校園', ['校园', '同桌', '学长']],['玄幻', ['玄幻', '修仙', '仙尊', '魔界']],
  ['仙俠', ['仙侠', '飞升', '修真']],['武俠', ['武侠', '江湖', '剑客']],['體育', ['体育', '球队', '拳']],
  ['喜劇', ['喜剧', '搞笑']],['女性成長', ['女性', '事业', '独立']],['商戰', ['商战', '股权']],['諜戰', ['谍战', '卧底']],
  ['無限流', ['无限流', '副本', '规则怪谈']],['種田', ['种田', '荒年', '村里']],['醫療', ['医生', '医术', '手术']],
  ['律政', ['律师', '法庭']],['軍旅', ['军旅', '特种兵', '军营']],['非遺', ['非遗', '传承']],['文旅', ['文旅', '旅游', '古城']],
  ['音樂', ['音乐', '歌手']],['美食', ['美食', '厨']],['科幻', ['科幻', '外星']],['恐怖', ['恐怖', '灵异', '鬼']],
]
const infer = (t) => {
  for (const [g, keys] of GENRES) if (keys.some((k) => t.includes(k))) return [g]
  return ['其他']
}

async function detail(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal })
    if (!res.ok) return null
    const h = await res.text()
    const titleM = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? h.match(/<title>([\s\S]*?)<\/title>/)
    const title = strip(titleM?.[1] ?? '').replace(/短剧|在线观看|剧情介绍|全集/g, '').trim()
    const date = (h.match(/20(2[3-6])-\d{2}-\d{2}/) ?? [])[0]
    if (!date) return null
    const year = 2000 + Number(h.match(/20(2[3-6])-/)[1])
    const introM = h.match(/剧情简介[\s\S]{0,80}?<p[^>]*>([\s\S]*?)<\/p>/)
    const intro = strip(introM?.[1] ?? '')
    const ownerM = h.match(/版权方[\s\S]{0,120}?<[^>]+>([\s\S]*?)<\/span>/)
    const owner = strip(ownerM?.[1] ?? '') || '未查證'
    return { title: title || '', year, date, owner, intro }
  } catch { return null } finally { clearTimeout(timer) }
}

const rows = []
let i = 0
const CONCURRENCY = 8
let cursor = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < candidates.length && rows.length < TARGET) {
    const [k, v] = candidates[cursor++]
    i++
    const d = await detail(v.url)
    if (d && d.year >= 2023 && d.year <= 2026 && norm(d.title).includes(k.slice(0, 8))) {
      const genres = infer(`${v.title} ${d.intro}`)
      rows.push({ year: d.year, title: v.title, platform: d.owner, genres, url: v.url, fact: `作品頁收錄｜上線 ${d.date}${d.owner !== '未查證' ? `｜版權方 ${d.owner}` : ''}` })
    }
    if (i % 25 === 0) process.stdout.write(`\r  checked ${i}, added ${rows.length}`)
    await sleep(120)
  }
}))

const tsv = rows.map((r) => [r.year, r.title, r.platform, r.genres.join(','), r.url, r.fact].join('\t')).join('\n')
await fs.writeFile('scripts/seed/incoming/directory-fill.tsv', tsv, 'utf8')
console.log(`\n✅ added ${rows.length} verified candidates → scripts/seed/incoming/directory-fill.tsv`)
console.log('   by year:', rows.reduce((m, r) => ((m[r.year] = (m[r.year] ?? 0) + 1), m), {}))
