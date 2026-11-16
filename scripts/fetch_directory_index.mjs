#!/usr/bin/env node
/**
 * 建立短劇目錄索引（劇名 → 作品頁 URL），用於逐筆驗證。
 * Build a title → per-title page index for verification.
 * 只抓列表頁（每頁 30 筆），低頻、只取標題與連結。
 * 用法 / Usage: node scripts/fetch_directory_index.mjs [pages]
 */
import fs from 'node:fs/promises'
const PAGES = Number(process.argv[2] ?? 120)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s).toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜]/g, '')
const index = new Map()
let empty = 0
for (let page = 1; page <= PAGES; page++) {
  let html
  try {
    const res = await fetch(`https://duanjubaike.org/zh-Hans/drama/list?page=${page}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) break
    html = await res.text()
  } catch { break }
  const cards = [...html.matchAll(/href="https:\/\/duanjubaike\.org\/zh-Hans\/drama\/(\d+)"[^>]*>\s*<img[^>]*alt="([^"]+)"/g)]
  const uniq = new Map(cards.map((m) => [m[1], m[2]]))
  if (!uniq.size) { empty++; if (empty >= 2) break; continue }
  for (const [id, title] of uniq) {
    const k = norm(title)
    if (!index.has(k)) index.set(k, { id, title, url: `https://duanjubaike.org/zh-Hans/drama/${id}` })
  }
  if (page % 20 === 0) console.log(`  page ${page}: index ${index.size}`)
  await sleep(450)
}
const out = { source: 'duanjubaike.org list pages', fetchedAt: new Date().toISOString().slice(0, 10), count: index.size, byTitle: Object.fromEntries(index) }
await fs.mkdir('data', { recursive: true })
await fs.writeFile('data/directory-index.json', JSON.stringify(out), 'utf8')
console.log(`✅ ${index.size} titles indexed → data/directory-index.json`)
