#!/usr/bin/env node
/**
 * 模型與資料集效能診斷（全免費、可重跑）
 * Model & dataset diagnostics (free, reproducible)
 *
 * 用法 / Usage: node scripts/benchmark.mjs
 *
 * 量測項目 / What it measures:
 *   1. 資料集大小與載入時間 / dataset size and JSON parse time
 *   2. 計分計算時間 / scoring throughput
 *   3. 分數分布 / score distribution per medium
 *   4. 維度相關性 / dimension correlation (redundancy check)
 *   5. 權重擾動下的排名穩定度（Spearman ρ）/ rank stability under ±20% weight perturbation
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'app/public/data/works.json')
const DIMS = ['reach', 'quality', 'buzz', 'momentum', 'crossover']
const MEDIA = ['shortdrama', 'anime', 'novel', 'film']

const t0 = performance.now()
const raw = await fs.readFile(FILE)
const tRead = performance.now() - t0
const t1 = performance.now()
const data = JSON.parse(raw.toString('utf8'))
const tParse = performance.now() - t1
const gz = zlib.gzipSync(raw, { level: 6 })

const works = data.works
const n = works.length

// ---- 1) 大小 / size ----
const kb = (x) => (x / 1024).toFixed(1) + ' KB'
console.log('=== 資料集 / Dataset ===')
console.log(`works: ${n}`, data.counts)
console.log(`raw: ${kb(raw.length)} | gzip: ${kb(gz.length)}`)
console.log(`read: ${tRead.toFixed(1)} ms | JSON.parse: ${tParse.toFixed(1)} ms`)
console.log(`sources: ${data.sourceCount}`)
const measured = works.filter((w) => w.provenance.status === 'measured').length
console.log(`measured: ${measured} (${((100 * measured) / n).toFixed(1)}%) | estimated: ${n - measured}`)

// ---- 2) 計分吞吐 / scoring throughput ----
function scoreAll(list, weights) {
  return list.map((w) => {
    const wt = weights[w.medium]
    const rawScore = DIMS.reduce((s, d) => s + w.dims[d] * wt[d], 0)
    const nEff = w.provenance.status === 'measured' ? (w.metrics?.ratingCount ?? 0) : 0
    const lambda = nEff ? Math.max(0.93, nEff / (nEff + 600)) : 1
    return 50 + (rawScore - 50) * lambda
  })
}

const t2 = performance.now()
const ITER = 100
for (let i = 0; i < ITER; i++) scoreAll(works, data.weights)
const tScore = (performance.now() - t2) / ITER
console.log(`\n=== 計分效能 / Scoring ===`)
console.log(`score all ${n} works: ${tScore.toFixed(2)} ms/run (${ITER} runs avg)`)
console.log(`→ ~${Math.round(1000 / tScore).toLocaleString()} runs/sec`)

// ---- 3) 分布 / distribution ----
const quantile = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
console.log(`\n=== 分數分布 / Score distribution ===`)
for (const m of MEDIA) {
  const arr = works.filter((w) => w.medium === m).map((w) => w.hitScore)
  if (!arr.length) continue
  console.log(
    `${m.padEnd(11)} n=${String(arr.length).padStart(4)}  p10=${quantile(arr, 0.1).toFixed(1)}  median=${quantile(arr, 0.5).toFixed(1)}  p90=${quantile(arr, 0.9).toFixed(1)}  max=${Math.max(...arr).toFixed(1)}`,
  )
}
const all = works.map((w) => w.hitScore)
console.log(`all         n=${n}  p10=${quantile(all, 0.1).toFixed(1)}  median=${quantile(all, 0.5).toFixed(1)}  p90=${quantile(all, 0.9).toFixed(1)}`)

// ---- 4) 維度相關性 / dimension correlation ----
function pearson(xs, ys) {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy || 1)
}
console.log(`\n=== 維度相關性 / Dimension correlation (Pearson) ===`)
console.log('           ' + DIMS.map((d) => d.padStart(10)).join(''))
for (const a of DIMS) {
  const row = DIMS.map((b) => pearson(works.map((w) => w.dims[a]), works.map((w) => w.dims[b])).toFixed(2).padStart(10)).join('')
  console.log(a.padEnd(11) + row)
}

// ---- 5) 排名穩定度 / rank stability ----
function spearman(a, b) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
    const r = new Array(arr.length)
    idx.forEach(([, i], k) => (r[i] = k + 1))
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  return pearson(ra, rb)
}

const base = scoreAll(works, data.weights)
const sampleIdx = works.map((_, i) => i).filter((_, i) => i % Math.max(1, Math.floor(n / 400)) === 0)
const rhos = []
const rnd = (() => {
  let s = 42
  return () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648)
})()

for (let iter = 0; iter < 50; iter++) {
  const w = {}
  for (const m of MEDIA) {
    const baseW = data.weights[m]
    const noisy = {}
    let sum = 0
    for (const d of DIMS) {
      const v = baseW[d] * (0.8 + 0.4 * rnd()) // ±20%
      noisy[d] = v
      sum += v
    }
    for (const d of DIMS) noisy[d] /= sum
    w[m] = noisy
  }
  const perturbed = scoreAll(works, w)
  const a = sampleIdx.map((i) => base[i])
  const b = sampleIdx.map((i) => perturbed[i])
  rhos.push(spearman(a, b))
}
rhos.sort((a, b) => a - b)
console.log(`\n=== 權重 ±20% 擾動下的排名穩定度 / Rank stability under ±20% weight perturbation ===`)
console.log(`sample n=${sampleIdx.length}, runs=50`)
console.log(`Spearman ρ: mean=${(rhos.reduce((a, b) => a + b, 0) / rhos.length).toFixed(3)}  min=${rhos[0].toFixed(3)}  p10=${rhos[Math.floor(rhos.length * 0.1)].toFixed(3)}`)
console.log(rhos[0] >= 0.7 ? '→ 通過（≥0.7）/ PASS' : '→ 未達 0.7，需檢查權重或維度設計 / FAIL')

console.log(`\n注意：以上是「計算效能」與「內部一致性」；預測效度（分數能否預測下月爆紅）需要累積史快照後回測。`)
console.log(`Note: this measures compute performance and internal consistency; predictive validity needs accumulated snapshots and out-of-time backtesting.`)
