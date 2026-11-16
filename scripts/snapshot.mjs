#!/usr/bin/env node
/**
 * 每日快照：冷凍當天的分數與熱度，供未來的「回測」使用。
 * Daily snapshot: freeze today's scores and heat levels for future backtesting.
 *
 * 用法 / Usage: node scripts/snapshot.mjs
 *
 * 為什麼要做 / Why:
 *   回測必須只用「當時已知」的資料，否則會產生前視偏差（look-ahead bias）。
 *   快照就是資料的「時光機」：今天的分數 + 今天的熱度，存成不可變檔案；
 *   一個月後就能比較「上個月的分數」是否預測「這個月的熱度變化」。
 *   Backtests must only use information available at the time, otherwise the
 *   result is contaminated by look-ahead bias. A snapshot is a time machine:
 *   today's scores plus today's heat, frozen in an immutable file, so that later
 *   we can test whether last month's scores predicted this month's heat change.
 *
 * 輸出 / Output:
 *   data/snapshots/YYYY-MM-DD.json   每日精簡快照（約 100–200 KB）
 *   data/snapshots/index.json        快照索引
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKS = path.join(ROOT, 'app/public/data/works.json')
const DIR = path.join(ROOT, 'data/snapshots')

const data = JSON.parse(await fs.readFile(WORKS, 'utf8'))
const date = data.snapshotDate || new Date().toISOString().slice(0, 10)

// 只存回測需要的欄位，控制檔案大小 / store only what backtests need
const items = data.works.map((w) => ({
  id: w.id,
  medium: w.medium,
  hitScore: w.hitScore,
  dims: w.dims,
  // 熱度代理：優先用平台原始量，沒有就用 reach 維度
  // Heat proxy: prefer the platform-native count, fall back to the reach dimension.
  heat:
    w.metrics?.popularity ??
    w.metrics?.collect ??
    w.metrics?.ratingCount ??
    Math.round(w.dims.reach * 1000),
}))

const snap = {
  date,
  modelVersion: data.modelVersion,
  datasetVersion: data.version,
  count: items.length,
  items,
}

await fs.mkdir(DIR, { recursive: true })
await fs.writeFile(path.join(DIR, `${date}.json`), JSON.stringify(snap), 'utf8')

// 更新索引 / update the index
let index = { snapshots: [] }
try {
  index = JSON.parse(await fs.readFile(path.join(DIR, 'index.json'), 'utf8'))
} catch {
  /* 第一次執行 / first run */
}
index.snapshots = [...new Set([...(index.snapshots ?? []), date])].sort()
await fs.writeFile(path.join(DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8')

console.log(`✅ snapshot ${date}: ${items.length} works → data/snapshots/${date}.json`)
if (index.snapshots.length < 2) {
  console.log('ℹ️  目前只有 1 份快照；回測需要至少 2 份（建議間隔 7–30 天）。')
  console.log('   Only one snapshot so far; a backtest needs at least two (7–30 days apart recommended).')
} else {
  console.log(`   快照總數 / total snapshots: ${index.snapshots.length} (${index.snapshots[0]} → ${index.snapshots.at(-1)})`)
}
