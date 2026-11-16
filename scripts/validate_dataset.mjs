#!/usr/bin/env node
/**
 * 資料集驗證器：確認 works.json 的結構、分數一致性與來源完整性。
 * Dataset validator: checks schema, score consistency and provenance completeness.
 *
 * 用法 / Usage: node scripts/validate_dataset.mjs
 * 失敗時 exit 1，可直接放進 CI。/ Exits 1 on failure, so it is CI-friendly.
 */

import fs from 'node:fs/promises'

const DIMS = ['reach', 'quality', 'buzz', 'momentum', 'crossover']
const MEDIA = ['shortdrama', 'anime', 'novel', 'film']
const STATUS = ['measured', 'estimated', 'illustrative']

const errors = []
const warnings = []
const fail = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

const data = JSON.parse(
  await fs.readFile(new URL('../app/public/data/works.json', import.meta.url), 'utf8'),
)

// ---- 1) 檔案層級 / file level ----
for (const key of ['dataset', 'version', 'snapshotDate', 'modelVersion', 'weights', 'dims', 'works']) {
  if (!(key in data)) fail(`missing top-level field: ${key}`)
}
if (!Array.isArray(data.works) || data.works.length === 0) fail('works must be a non-empty array')

for (const m of MEDIA) {
  const w = data.weights?.[m]
  if (!w) {
    fail(`missing weights for medium: ${m}`)
    continue
  }
  const sum = DIMS.reduce((s, d) => s + (w[d] ?? 0), 0)
  if (Math.abs(sum - 1) > 1e-6) fail(`weights[${m}] sum to ${sum}, expected 1`)
}

// ---- 2) 逐筆檢查 / per-record checks ----
const ids = new Set()
const counts = {}

for (const w of data.works ?? []) {
  const id = w.id
  if (!id) {
    fail('work without id')
    continue
  }
  if (ids.has(id)) fail(`duplicate id: ${id}`)
  ids.add(id)

  if (!MEDIA.includes(w.medium)) fail(`${id}: invalid medium ${w.medium}`)
  counts[w.medium] = (counts[w.medium] ?? 0) + 1

  if (!w.title?.zh || !w.title?.en) fail(`${id}: title.zh and title.en are required`)
  if (!w.synopsis?.zh || !w.synopsis?.en) fail(`${id}: synopsis must be bilingual`)

  for (const d of DIMS) {
    const v = w.dims?.[d]
    if (typeof v !== 'number' || v < 0 || v > 100) fail(`${id}: dims.${d} out of range (${v})`)
  }

  if (typeof w.hitScore !== 'number' || w.hitScore < 0 || w.hitScore > 100) {
    fail(`${id}: hitScore out of range`)
  }

  const weights = data.weights[w.medium]
  if (weights) {
    const raw = DIMS.reduce((s, d) => s + w.dims[d] * weights[d], 0)
    const measuredWithSample = w.provenance?.status === 'measured' && (w.metrics?.ratingCount ?? 0) > 0
    if (!measuredWithSample && Math.abs(raw - w.hitScore) > 0.35) {
      // 估算資料不做樣本收縮，必須等於加權和 / estimated records must equal the weighted sum
      fail(`${id}: hitScore ${w.hitScore} != weighted dims ${raw.toFixed(2)}`)
    }
    const sumContrib = (w.contributions ?? []).reduce((s, c) => s + c.points, 0)
    if (Math.abs(sumContrib - (w.hitScore - 50)) > 0.6) {
      fail(`${id}: contributions sum ${sumContrib.toFixed(2)} != hitScore - 50`)
    }
  }

  if (!Array.isArray(w.ci) || w.ci.length !== 2 || !(w.ci[0] <= w.hitScore && w.hitScore <= w.ci[1])) {
    fail(`${id}: invalid CI ${JSON.stringify(w.ci)}`)
  }
  if (!['high', 'medium', 'low'].includes(w.confidence)) fail(`${id}: invalid confidence`)

  const prov = w.provenance
  if (!prov || !STATUS.includes(prov.status)) fail(`${id}: invalid provenance.status`)
  if (!Array.isArray(prov?.sources) || prov.sources.length === 0) {
    fail(`${id}: provenance.sources must not be empty`)
  }
  if (prov?.status === 'estimated' && (!prov.note?.zh || !prov.note?.en)) {
    warn(`${id}: estimated record without bilingual note`)
  }
  if (w.heatCurve && w.heatCurve.length !== 12) warn(`${id}: heatCurve length ${w.heatCurve.length} (expected 12)`)
  if (w.provenance.status !== 'measured' && !w.drivers?.length) {
    warn(`${id}: no drivers for an estimated record`)
  }
}

// ---- 3) 報告 / report ----
console.log(`Dataset: ${data.dataset} v${data.version} (${data.snapshotDate})`)
console.log(`Works: ${data.works.length}`, counts)
for (const [m, n] of Object.entries(counts)) {
  if (n < 5) warn(`medium ${m} only has ${n} records`)
}

if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} warning(s):`)
  warnings.forEach((w) => console.log('  -', w))
}
if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`)
  errors.forEach((e) => console.error('  -', e))
  process.exit(1)
}
console.log('\n✅ dataset is valid / 資料集驗證通過')
