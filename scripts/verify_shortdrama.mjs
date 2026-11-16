#!/usr/bin/env node
/**
 * 逐筆驗證短劇：每一部都必須有「作品專屬頁面」，且頁面標題能對上。
 * Verify every short drama: it must have a per-title page whose title matches.
 *
 * 用法 / Usage: node scripts/verify_shortdrama.mjs
 *
 * 產出 / Output:
 *   data/verified-shortdrama.json   通過驗證的清單（id → {url, checkedAt, matchType}）
 *   data/unverified-shortdrama.json 未通過者（隔離，不發布）
 *   data/verification-report.json   統計摘要
 *
 * 判定 / Rules:
 *   - per-title page 且 HTTP 200 且頁面含標題（簡繁、標點正規化後）→ verified
 *   - 只有榜單文章、且抓不到標題 → unverified
 *   - 來源站阻擋（403/429）但目錄索引有專屬頁 → 以目錄頁為準
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKS = path.join(ROOT, 'app/public/data/works.json')
const INDEX = path.join(ROOT, 'data/directory-index.json')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

const toCN = OpenCC.Converter({ from: 'tw', to: 'cn' })
const norm = (s) =>
  toCN(String(s))
    .toLowerCase()
    .replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】~〜"“”'’]/g, '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (s) => String(s).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

/** 去掉季數後綴，提高匹配率 / strip season suffixes */
const baseTitle = (t) =>
  norm(t)
    .replace(/第[0-9一二三四五六七八九十百]+[季部期]/g, '')
    .replace(/season[0-9]+/g, '')
    .replace(/[0-9]+$/g, '')

async function fetchPage(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' })
    const text = res.ok ? strip(await res.text()) : ''
    return { status: res.status, text }
  } catch (e) {
    return { status: 0, text: '', error: e.message }
  } finally {
    clearTimeout(timer)
  }
}

const works = JSON.parse(await fs.readFile(WORKS, 'utf8')).works.filter((w) => w.medium === 'shortdrama')
const index = JSON.parse(await fs.readFile(INDEX, 'utf8')).byTitle

// 建立兩種索引：完整標題、去季數標題 / two lookup maps
const indexExact = new Map(Object.entries(index).map(([k, v]) => [k, v]))
const indexBase = new Map()
for (const [k, v] of Object.entries(index)) {
  const b = baseTitle(k)
  if (b && !indexBase.has(b)) indexBase.set(b, v)
}

const verified = {}
const unverified = []
const stats = { total: works.length, verified: 0, bySource: {} }
const CONCURRENCY = 8

async function checkWork(w) {
  const key = norm(w.title.zh)
  const hit = indexExact.get(key) ?? indexBase.get(baseTitle(w.title.zh))
  const candidate = hit?.url ?? w.provenance?.sources?.find((s) => s.url)?.url
  if (!candidate) {
    unverified.push({ id: w.id, title: w.title.zh, reason: 'no-url' })
    return
  }
  const isPerTitle = !!hit || /drama\/\d+/.test(candidate) || /subject\/\d+/.test(candidate) || /item\//.test(candidate)
  const { status, text } = await fetchPage(candidate)
  const titleOk = text && norm(text).includes(baseTitle(w.title.zh))
  const urlOk = status === 200

  if (isPerTitle && urlOk && titleOk) {
    verified[w.id] = { url: candidate, checkedAt: new Date().toISOString().slice(0, 10), matchType: hit ? 'directory' : 'source-page' }
    stats.verified++
    stats.bySource[candidate.includes('duanjubaike') ? 'duanjubaike' : new URL(candidate).hostname] =
      (stats.bySource[candidate.includes('duanjubaike') ? 'duanjubaike' : new URL(candidate).hostname] ?? 0) + 1
  } else {
    unverified.push({
      id: w.id,
      title: w.title.zh,
      url: candidate,
      status,
      titleFound: !!titleOk,
      reason: !urlOk ? `http-${status}` : !isPerTitle ? 'list-page-only' : 'title-mismatch',
    })
  }
}

// 併發池 / concurrency pool
let cursor = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < works.length) {
      const w = works[cursor++]
      try {
        await checkWork(w)
      } catch (e) {
        unverified.push({ id: w.id, title: w.title.zh, reason: 'error:' + e.message })
      }
      if ((stats.verified + unverified.length) % 100 === 0) {
        process.stdout.write(`\r  進度 progress: ${stats.verified + unverified.length}/${works.length} (verified ${stats.verified})`)
      }
      await sleep(120)
    }
  }),
)

await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })
await fs.writeFile(path.join(ROOT, 'data/verified-shortdrama.json'), JSON.stringify({ checkedAt: new Date().toISOString().slice(0, 10), count: stats.verified, byId: verified }, null, 0), 'utf8')
await fs.writeFile(path.join(ROOT, 'data/unverified-shortdrama.json'), JSON.stringify(unverified, null, 1), 'utf8')
await fs.writeFile(path.join(ROOT, 'data/verification-report.json'), JSON.stringify({ ...stats, unverified: unverified.length, generatedAt: new Date().toISOString() }, null, 1), 'utf8')

console.log(`\n✅ verified ${stats.verified}/${works.length} short dramas`)
console.log(`   unverified ${unverified.length} → data/unverified-shortdrama.json`)
const reasons = {}
unverified.forEach((u) => (reasons[u.reason] = (reasons[u.reason] ?? 0) + 1))
console.log('   reasons:', reasons)
