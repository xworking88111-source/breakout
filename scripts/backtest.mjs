#!/usr/bin/env node
/**
 * 回測：用「上個月的分數」預測「這個月的熱度變化」。
 * Backtest: use last month's scores to predict this month's heat change.
 *
 * 用法 / Usage:
 *   node scripts/backtest.mjs                 # 自動選最後兩份快照 / last two snapshots
 *   node scripts/backtest.mjs 2026-11-16 2026-12-16
 *
 * 指標 / Metrics:
 *   Spearman ρ        分數與「熱度變化」的秩相關（越高越好）
 *   Precision@10%     分數前 10% 的作品，有多少比例真的落在熱度成長前 10%
 *   Lift@10%          Precision@10% / 隨機基準（1.0 = 沒有預測力）
 *   Mean Δheat        高分組 vs 低分組的熱度變化差異
 *
 * 重要 / Note:
 *   這是「樣本外、時間向前」的驗證，不是用同一份資料自我驗證。
 *   This is an out-of-time, forward-looking validation — not in-sample fitting.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'data/snapshots')
const [argA, argB] = process.argv.slice(2)
const STRICT = process.argv.includes('--strict')

const index = JSON.parse(await fs.readFile(path.join(DIR, 'index.json'), 'utf8'))
const dates = index.snapshots ?? []
if (dates.length < 2) {
  console.error('✋ 目前只有 ' + dates.length + ' 份快照，無法回測。')
  console.error('   需要至少 2 份快照（建議間隔 7–30 天）。執行方式：')
  console.error('     1) node scripts/snapshot.mjs        # 今天')
  console.error('     2) 等 7–30 天後再跑一次              # 或從 git 歷史取舊快照')
  console.error('     3) node scripts/backtest.mjs')
  // 預設不讓排程失敗；加 --strict 才會 exit 1（CI 檢查用）
  // Do not fail scheduled runs by default; use --strict to exit non-zero (for CI checks).
  process.exit(STRICT ? 1 : 0)
}

const d0 = argA ?? dates.at(-2)
const d1 = argB ?? dates.at(-1)
const load = async (d) => JSON.parse(await fs.readFile(path.join(DIR, `${d}.json`), 'utf8'))
const s0 = await load(d0)
const s1 = await load(d1)

const m1 = new Map(s1.items.map((x) => [x.id, x]))
const rows = []
for (const a of s0.items) {
  const b = m1.get(a.id)
  if (!b || !Number.isFinite(a.heat) || !Number.isFinite(b.heat) || a.heat <= 0 || b.heat <= 0) continue
  rows.push({
    id: a.id,
    medium: a.medium,
    score: a.hitScore,
    heat0: a.heat,
    heat1: b.heat,
    growth: Math.log(b.heat / a.heat), // 對數成長率 / log growth
  })
}

function spearman(xs, ys) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(arr.length)
    idx.forEach(([, i], k) => (r[i] = k + 1))
    return r
  }
  const rx = rank(xs)
  const ry = rank(ys)
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length
  const my = ry.reduce((a, b) => a + b, 0) / ry.length
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy || 1)
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const rho = spearman(rows.map((r) => r.score), rows.map((r) => r.growth))

// Precision@10% / Lift@10%
const k = Math.max(1, Math.round(rows.length * 0.1))
const byScore = [...rows].sort((a, b) => b.score - a.score).slice(0, k)
const byGrowth = [...rows].sort((a, b) => b.growth - a.growth).slice(0, k)
const growthSet = new Set(byGrowth.map((r) => r.id))
const hits = byScore.filter((r) => growthSet.has(r.id)).length
const precision = hits / k
const lift = precision / 0.1

const hi = rows.filter((r) => r.score >= median(rows.map((x) => x.score)))
const lo = rows.filter((r) => r.score < median(rows.map((x) => x.score)))
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
const deltaHi = mean(hi.map((r) => r.growth))
const deltaLo = mean(lo.map((r) => r.growth))

console.log(`=== 回測 / Backtest: ${d0} → ${d1} ===`)
console.log(`配對作品 / matched: ${rows.length}（快照交集）`)
console.log(`Spearman ρ(score, Δheat): ${rho.toFixed(3)}`)
console.log(`Precision@10%: ${(precision * 100).toFixed(1)}%  (k=${k}, hits=${hits})`)
console.log(`Lift@10%: ${lift.toFixed(2)}x`)
console.log(`平均對數成長 / mean log growth — 高分組: ${deltaHi.toFixed(3)}  低分組: ${deltaLo.toFixed(3)}  差: ${(deltaHi - deltaLo).toFixed(3)}`)
console.log(
  rho > 0.2 && lift > 1.5
    ? '→ 初步具備預測力 / promising predictive signal'
    : rho > 0
      ? '→ 訊號微弱，需要更多快照或修正模型 / weak signal'
      : '→ 未見預測力（或期間太短）/ no predictive signal yet',
)
console.log('\n提醒 / Caveat: 兩份快照間隔太短（<7 天）時，熱度變化多為雜訊；建議 7–30 天。')
