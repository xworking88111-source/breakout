#!/usr/bin/env node
/**
 * 用 Wikipedia 跨語言連結，為非中文／非英文作品補「最常見的中文與英文譯名」。
 * Fill common Chinese/English translated titles for non-Chinese works via Wikipedia langlinks.
 *
 * 用法 / Usage: node scripts/fetch_title_map.mjs
 *
 * 為什麼 / Why:
 *   AniList 只給原文（日文）與英文；Bangumi 只給中文名。對日文作品，
 *   我們需要「最常見的中文譯名」與英文譯名，才不會在中文介面顯示日文原名。
 *   Wikipedia 的跨語言連結（ja → zh / en、zh → en）是免費且可追溯的來源。
 *
 * 輸出 / Output: app/src/data/title-map.json
 *   { byNative: { 原文: { zh, en } }, byZh: { 中文名: { en } }, snapshotDate }
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'app/src/data')
const OUT = path.join(DATA, 'title-map.json')
const SNAPSHOT = new Date().toISOString().slice(0, 10)
const UA = 'breakout-index/0.1 (https://github.com/xworking88111-source/breakout)'
const DELAY = 400

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function langlinks(host, titles, lang) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'langlinks',
    lllang: lang,
    lllimit: '500',
    redirects: '1',
    titles: titles.join('|'),
  })
  const res = await fetch(`https://${host}/w/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: params.toString(),
  })
  if (!res.ok) throw new Error(`${host} HTTP ${res.status}`)
  const json = await res.json()
  const pages = json?.query?.pages ?? []
  const out = new Map()
  for (const p of pages) {
    const link = p.langlinks?.[0]?.title ?? p.langlinks?.[0]?.['*']
    if (p.title && link) out.set(p.title, link)
  }
  // redirects / normalized 對照 / aliases
  for (const n of json?.query?.normalized ?? []) out.set(n.from, out.get(n.to) ?? '')
  for (const r of json?.query?.redirects ?? []) out.set(r.from, out.get(r.to) ?? '')
  return out
}

async function batchQuery(host, titles, lang, result) {
  const unique = [...new Set(titles.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50)
    try {
      const map = await langlinks(host, batch, lang)
      for (const [k, v] of map) if (v) result.set(k, v)
    } catch (e) {
      console.warn('  !', host, lang, e.message)
    }
    process.stdout.write(`\r  ${host} → ${lang}: ${Math.min(i + 50, unique.length)}/${unique.length}`)
    await sleep(DELAY)
  }
  process.stdout.write('\n')
}

const readJson = async (p, fallback) => {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return fallback
  }
}

const anime = (await readJson(path.join(DATA, 'anime.json'), { items: [] })).items
const novels = (await readJson(path.join(DATA, 'bangumi-novel.json'), { items: [] })).items
const films = (await readJson(path.join(DATA, 'bangumi-film.json'), { items: [] })).items

const jpNative = [] // 日文原文，需要 zh + en
const zhNames = [] // 中文名，需要 en
for (const a of anime) {
  const native = a.title?.native
  if (native && /[\u3040-\u30ff]/.test(native)) jpNative.push(native)
}
for (const b of [...novels, ...films]) {
  const native = b.title?.en // Bangumi 的 name 是原文
  const zh = b.title?.zh
  if (native && /[\u3040-\u30ff]/.test(native)) jpNative.push(native)
  if (zh) zhNames.push(zh)
}

const zhFromJa = new Map()
const enFromJa = new Map()
const enFromZh = new Map()

console.log('1) 日文原文 → 中文譯名（ja.wikipedia langlinks zh）')
await batchQuery('ja.wikipedia.org', jpNative, 'zh', zhFromJa)
console.log('2) 日文原文 → 英文譯名（ja.wikipedia langlinks en）')
await batchQuery('ja.wikipedia.org', jpNative, 'en', enFromJa)
console.log('3) 中文名 → 英文譯名（zh.wikipedia langlinks en）')
await batchQuery('zh.wikipedia.org', zhNames, 'en', enFromZh)

const byNative = {}
for (const native of jpNative) {
  const zh = zhFromJa.get(native)
  const en = enFromJa.get(native)
  if (zh || en) byNative[native] = { ...(zh ? { zh } : {}), ...(en ? { en } : {}) }
}
const byZh = {}
for (const zh of zhNames) {
  const en = enFromZh.get(zh)
  if (en) byZh[zh] = { en }
}

const out = {
  source: 'Wikipedia langlinks (ja.wikipedia.org / zh.wikipedia.org)',
  snapshotDate: SNAPSHOT,
  license: 'Wikipedia 內容 CC BY-SA；此處僅存標題對照，使用時請標註來源。',
  counts: { jpNative: jpNative.length, byNative: Object.keys(byNative).length, byZh: Object.keys(byZh).length },
  byNative,
  byZh,
}
await fs.writeFile(OUT, JSON.stringify(out, null, 1), 'utf8')
console.log(`✅ title-map.json: ${Object.keys(byNative).length} native→zh/en, ${Object.keys(byZh).length} zh→en`)
console.log('   sample:', Object.entries(byNative).slice(0, 5).map(([k, v]) => `${k} → ${v.zh ?? ''} / ${v.en ?? ''}`).join(' | '))
