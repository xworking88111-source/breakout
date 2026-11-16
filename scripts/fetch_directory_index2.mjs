#!/usr/bin/env node
/**
 * 擴充短劇目錄索引：duanjubaike.net 列表頁（48 部/頁，robots 全允許）。
 * Expand the title → per-title page index from duanjubaike.net list pages.
 * 用法 / Usage: node scripts/fetch_directory_index2.mjs [pages] [startPage]
 */
import fs from 'node:fs/promises'
const PAGES = Number(process.argv[2] ?? 250)
const START = Number(process.argv[3] ?? 1)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const norm = (s) => String(s).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const file = 'data/directory-index.json'
const doc = JSON.parse(await fs.readFile(file, 'utf8'))
const byTitle = doc.byTitle ?? {}
const before = Object.keys(byTitle).length

async function fetchPage(page) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`https://www.duanjubaike.net/duanju/list.html?page=${page}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: ctrl.signal,
    })
    if (!res.ok) return []
    const html = await res.text()
    const cards = [...html.matchAll(/href="\/duanju\/(info-\d+)\.html"\s+title="短剧《([^》]+)》"/g)]
    return cards.map((m) => ({ id: m[1], title: m[2].trim(), url: `https://www.duanjubaike.net/duanju/${m[1]}.html` }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

let done = 0
let added = 0
const CONCURRENCY = 6
let cursor = START
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < START + PAGES) {
      const page = cursor++
      const cards = await fetchPage(page)
      for (const c of cards) {
        const k = norm(c.title)
        if (k && !byTitle[k]) {
          byTitle[k] = { id: c.id, title: c.title, url: c.url, source: 'duanjubaike.net' }
          added++
        }
      }
      done++
      if (done % 20 === 0) {
        process.stdout.write(`\r  pages ${done}/${PAGES}, index ${Object.keys(byTitle).length} (+${added})`)
        await fs.writeFile(file, JSON.stringify({ ...doc, count: Object.keys(byTitle).length, byTitle }), 'utf8')
      }
      await sleep(120)
    }
  }),
)
await fs.writeFile(file, JSON.stringify({ ...doc, count: Object.keys(byTitle).length, byTitle }), 'utf8')
console.log(`\n✅ index ${before} → ${Object.keys(byTitle).length} titles (+${added})`)
