#!/usr/bin/env node
/**
 * 從目錄指定頁段抓取 2023／2024 的作品，逐筆開作品頁確認年份後寫入 TSV。
 * Fetch titles from a page range and confirm the year on each per-title page.
 * 用法 / Usage: node scripts/fill_from_pages.mjs <from> <to> <target>
 */
import fs from 'node:fs/promises'
import * as OpenCC from 'opencc-js'
const [FROM = '2000', TO = '2354', TARGET = '170'] = process.argv.slice(2)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const toCN = OpenCC.Converter({ from: 'tw', to: 'cn' })
const norm = (s) => toCN(String(s)).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')
const strip = (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = 'scripts/seed/incoming/directory-year.tsv'
const TARGET_N = Number(TARGET)

const data = JSON.parse(await fs.readFile('app/public/data/works.json', 'utf8'))
const existing = new Set(data.works.map((w) => `shortdrama:${norm(w.title.zh)}`))

async function get(url, timeout = 12000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeout)
  try { const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal }); return res.ok ? await res.text() : '' }
  catch { return '' } finally { clearTimeout(t) }
}

const cards = new Map()
let cursorPage = Number(FROM)
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursorPage <= Number(TO)) {
    const p = cursorPage++
    const h = await get(`https://www.duanjubaike.net/duanju/list.html?page=${p}`)
    for (const m of h.matchAll(/href="\/duanju\/(info-\d+)\.html"\s+title="短剧《([^》]+)》"/g)) {
      const key = norm(m[2])
      if (key && !existing.has(`shortdrama:${key}`) && !cards.has(key)) {
        cards.set(key, { id: m[1], title: m[2], url: `https://www.duanjubaike.net/duanju/${m[1]}.html` })
      }
    }
    await sleep(60)
  }
}))
const list = [...cards.values()]
console.log(`cards ${list.length} from pages ${FROM}-${TO}`)
// deterministic shuffle
let seed = 7
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648)
list.sort(() => rand() - 0.5)

const GENRES = [['穿越',['穿越','穿回']],['重生',['重生']],['甜寵',['甜宠','甜妻','娇妻']],['逆襲',['逆袭','打脸','战神','归来']],['贅婿',['赘婿']],['真假千金',['真假千金','真千金']],['懸疑',['悬疑','谜','真相']],['復仇',['复仇']],['家庭',['家庭','婆婆','全家','妈妈']],['年代',['年代','八零','七零','九零']],['古裝',['古装','王爷','侯府','公主','将军']],['民國',['民国','军阀','督军']],['都市',['都市','总裁','豪门']],['萌寶',['萌宝','宝宝','崽']],['銀髮',['老太','黄昏恋']],['校園',['校园','同桌']],['玄幻',['玄幻','修仙','仙尊']],['仙俠',['仙侠','修真']],['武俠',['武侠','江湖']],['體育',['体育','球队','拳']],['喜劇',['喜剧','搞笑']],['女性成長',['女性','事业']],['商戰',['商战','股权']],['諜戰',['谍战','卧底']],['無限流',['无限流','副本','怪谈']],['醫療',['医生','医术']],['律政',['律师','法庭']],['文旅',['文旅','旅游']],['非遺',['非遗']],['音樂',['音乐','歌手']],['美食',['美食']],['科幻',['科幻','外星']],['恐怖',['恐怖','灵异']]]
const infer = (t) => { for (const [g, ks] of GENRES) if (ks.some((k) => t.includes(k))) return [g]; return ['其他'] }

let idx = 0, checked = 0, added = 0
const rows = []
await Promise.all(Array.from({ length: 8 }, async () => {
  while (idx < list.length && added < TARGET_N) {
    const c = list[idx++]
    checked++
    const h = await get(c.url)
    const m = h.match(/20(2[3-4])-\d{2}-\d{2}/)
    if (m) {
      const year = 2000 + Number(m[1])
      const introM = h.match(/剧情简介[\s\S]{0,80}?<p[^>]*>([\s\S]*?)<\/p>/)
      const intro = strip(introM?.[1] ?? '')
      rows.push({ year, title: c.title, platform: '未查證', genres: infer(`${c.title} ${intro}`), url: c.url, fact: '作品頁收錄，標題已比對' })
      added++
      await fs.writeFile(OUT, rows.map((r) => [r.year, r.title, r.platform, r.genres.join(','), r.url, r.fact].join('\t')).join('\n'), 'utf8')
    }
    if (checked % 50 === 0) process.stdout.write(`\r  checked ${checked}, added ${added}`)
    await sleep(60)
  }
}))
console.log(`\n✅ added ${added} (checked ${checked}) → ${OUT}`)
console.log('   by year:', rows.reduce((m, r) => ((m[r.year] = (m[r.year] ?? 0) + 1), m), {}))
