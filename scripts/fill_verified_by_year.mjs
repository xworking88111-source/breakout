#!/usr/bin/env node
/**
 * 依年份補入「已可驗證」的短劇（2023／2024）。
 * Add verified short dramas for specific years from the directory index.
 * 用法 / Usage: node scripts/fill_verified_by_year.mjs <years> <target> <sliceStart> <sliceEnd>
 * 例如 / e.g.: node scripts/fill_verified_by_year.mjs 2023,2024 160 38000 57000
 */
import fs from 'node:fs/promises'
import * as OpenCC from 'opencc-js'

const [yearsArg = '2023,2024', targetArg = '160', startArg = '38000', endArg = '57000'] = process.argv.slice(2)
const YEARS = new Set(yearsArg.split(',').map(Number))
const TARGET = Number(targetArg)
const START = Number(startArg)
const END = Number(endArg)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const toCN = OpenCC.Converter({ from: 'tw', to: 'cn' })
const norm = (s) => toCN(String(s)).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')
const strip = (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = 'scripts/seed/incoming/directory-year.tsv'

const data = JSON.parse(await fs.readFile('app/public/data/works.json', 'utf8'))
const existing = new Set(data.works.map((w) => `shortdrama:${norm(w.title.zh)}`))
const index = JSON.parse(await fs.readFile('data/directory-index.json', 'utf8')).byTitle
const all = Object.entries(index).filter(([k]) => !existing.has(`shortdrama:${k}`))
const candidates = all.slice(START, END)
console.log(`candidates ${candidates.length} (slice ${START}-${END}), target years ${[...YEARS].join('/')}`)

const GENRES = [['穿越',['穿越','穿回']],['重生',['重生']],['甜寵',['甜宠','甜妻','娇妻']],['逆襲',['逆袭','打脸','战神','归来']],['贅婿',['赘婿']],['真假千金',['真假千金','真千金','假千金']],['懸疑',['悬疑','谜','真相']],['復仇',['复仇']],['家庭',['家庭','婆婆','全家','妈妈']],['年代',['年代','八零','七零','九零']],['古裝',['古装','王爷','侯府','公主','将军']],['民國',['民国','军阀','督军']],['都市',['都市','总裁','豪门']],['萌寶',['萌宝','宝宝','崽']],['銀髮',['老太','黄昏恋']],['校園',['校园','同桌']],['玄幻',['玄幻','修仙','仙尊']],['仙俠',['仙侠','修真']],['武俠',['武侠','江湖']],['體育',['体育','球队','拳']],['喜劇',['喜剧','搞笑']],['女性成長',['女性','事业']],['商戰',['商战','股权']],['諜戰',['谍战','卧底']],['無限流',['无限流','副本','怪谈']],['醫療',['医生','医术']],['律政',['律师','法庭']],['文旅',['文旅','旅游']],['非遺',['非遗']],['音樂',['音乐','歌手']],['美食',['美食']],['科幻',['科幻','外星']],['恐怖',['恐怖','灵异']]]
const infer = (t) => { for (const [g, ks] of GENRES) if (ks.some((k) => t.includes(k))) return [g]; return ['其他'] }

async function detail(url) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal })
    if (!res.ok) return null
    const h = await res.text()
    const m = h.match(/20(2[3-6])-\d{2}-\d{2}/)
    if (!m) return null
    const year = 2000 + Number(m[1])
    const introM = h.match(/剧情简介[\s\S]{0,80}?<p[^>]*>([\s\S]*?)<\/p>/)
    return { year, intro: strip(introM?.[1] ?? '') }
  } catch { return null } finally { clearTimeout(timer) }
}

const rows = []
let cursor = 0
let checked = 0
const CONCURRENCY = 8
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < candidates.length && rows.length < TARGET) {
    const [k, v] = candidates[cursor++]
    checked++
    const d = await detail(v.url)
    if (d && YEARS.has(d.year)) {
      const tags = infer(`${v.title} ${d.intro}`)
      rows.push({ year: d.year, title: v.title, platform: '未查證', genres: tags, url: v.url, fact: '作品頁收錄，標題已比對' })
      const tsv = rows.map((r) => [r.year, r.title, r.platform, r.genres.join(','), r.url, r.fact].join('\t')).join('\n')
      await fs.writeFile(OUT, tsv, 'utf8')
    }
    if (checked % 40 === 0) process.stdout.write(`\r  checked ${checked}, added ${rows.length}`)
    await sleep(80)
  }
}))

console.log(`\n✅ added ${rows.length} (checked ${checked}) → ${OUT}`)
console.log('   by year:', rows.reduce((m, r) => ((m[r.year] = (m[r.year] ?? 0) + 1), m), {}))
