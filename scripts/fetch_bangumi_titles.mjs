#!/usr/bin/env node
/**
 * 對 Wikipedia 查不到中文譯名的日文作品，改用 Bangumi 搜尋補 name_cn。
 * Fill missing Chinese titles from Bangumi search as a second-pass fallback.
 * 用法 / Usage: node scripts/fetch_bangumi_titles.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'app/src/data')
const UA = 'breakout-index/0.1 (+https://github.com/xworking88111-source/breakout)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')

const read = async (p, fb) => { try { return JSON.parse(await fs.readFile(p, 'utf8')) } catch { return fb } }
const anime = (await read(path.join(DATA, 'anime.json'), { items: [] })).items
const map = await read(path.join(DATA, 'title-map.json'), { byNative: {}, byZh: {} })

const need = [...new Set(anime.map((a) => a.title?.native).filter((n) => n && /[\u3040-\u30ff]/.test(n) && !map.byNative[n]?.zh))]
console.log('需要補中文名的作品 / missing zh:', need.length)

let added = 0
for (let i = 0; i < need.length; i++) {
  const title = need[i]
  try {
    const res = await fetch('https://api.bgm.tv/v0/search/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ keyword: title, sort: 'match', filter: { type: [2] }, limit: 5 }),
    })
    if (res.ok) {
      const rows = (await res.json())?.data ?? []
      const hit = rows.find((r) => norm(r.name) === norm(title) || norm(r.name).includes(norm(title)) || norm(title).includes(norm(r.name)))
      const zh = hit?.name_cn || rows[0]?.name_cn
      if (zh && !/[\u3040-\u30ff]/.test(zh)) {
        map.byNative[title] = { ...(map.byNative[title] ?? {}), zh }
        added++
      }
    }
  } catch { /* skip */ }
  if (i % 20 === 0) process.stdout.write(`\r  ${i}/${need.length} (added ${added})`)
  await sleep(1100)
}
map.counts = { ...(map.counts ?? {}), bangumiFallback: added }
map.source = 'Wikipedia langlinks + Bangumi search fallback'
await fs.writeFile(path.join(DATA, 'title-map.json'), JSON.stringify(map, null, 1), 'utf8')
console.log(`\n✅ added ${added} Chinese titles from Bangumi; total byNative ${Object.keys(map.byNative).length}`)
