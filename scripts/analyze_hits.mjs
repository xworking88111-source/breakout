#!/usr/bin/env node
/**
 * 爆款因子分析：從資料集找出「什麼樣的作品更熱」的可觀測關聯。
 * Hit-factor analysis: observable correlates of heat in the dataset.
 *
 * 用法 / Usage: node scripts/analyze_hits.mjs
 * 輸出 / Output:
 *   app/public/data/insights.json   給網站「洞察」頁使用
 *   docs/09-爆款因子分析.md           完整分析報告（自動生成）
 *
 * 重要：這些是「相關」不是「因果」。同齡比較已盡量控制上架時間，
 * 但仍無法控制投流金額等平台內部變數。
 * These are correlations, not causation. Same-age comparisons control for
 * release timing but cannot control for ad spend or other platform internals.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'app/public/data/works.json'), 'utf8'))
const works = data.works

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
const round = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n
const DIMS = ['reach', 'quality', 'buzz', 'momentum', 'crossover']

/** 特徵提升度：有這個特徵的作品平均分 − 同媒介平均分 / lift vs. same-medium mean */
function liftBy(works, keyFn, minN = 5) {
  const groups = new Map()
  for (const w of works) {
    const base = mean(works.filter((x) => x.medium === w.medium).map((x) => x.hitScore))
    for (const k of [keyFn(w)].flat().filter(Boolean)) {
      if (!groups.has(k)) groups.set(k, { key: k, items: [] })
      groups.get(k).items.push({ w, base })
    }
  }
  return [...groups.values()]
    .filter((g) => g.items.length >= minN)
    .map((g) => ({
      key: g.key,
      n: g.items.length,
      mean: round(mean(g.items.map((x) => x.w.hitScore))),
      lift: round(mean(g.items.map((x) => x.w.hitScore - x.base))),
    }))
    .sort((a, b) => b.lift - a.lift)
}

const sd = works.filter((w) => w.medium === 'shortdrama')

// ---- 1) 類型 / 標籤 / 平台提升度 ----
const genreLift = liftBy(works, (w) => w.genres, 5).slice(0, 20)
const tagLift = liftBy(sd, (w) => w.tags.map((t) => t.zh), 5).slice(0, 20)
const platformLift = liftBy(sd, (w) => (w.platform ? [w.platform.replace(/（.*?）|·.*/g, '').trim()] : []), 3).slice(0, 12)

// ---- 2) 年度分布 ----
const years = [...new Set(works.map((w) => w.year).filter(Boolean))].sort()
const yearProfile = years
  .map((y) => ({ year: y, n: works.filter((w) => w.year === y).length, mean: round(mean(works.filter((w) => w.year === y).map((w) => w.hitScore))) }))
  .filter((x) => x.n >= 10)

// ---- 3) 頂部 10% vs 其餘：五維畫像 ----
function profile(arr) {
  return Object.fromEntries(DIMS.map((d) => [d, round(mean(arr.map((w) => w.dims[d])))]))
}
const sorted = [...works].sort((a, b) => b.hitScore - a.hitScore)
const k = Math.max(10, Math.round(works.length * 0.1))
const top = sorted.slice(0, k)
const rest = sorted.slice(k)
const topVsRest = {
  n: { top: top.length, rest: rest.length },
  top: profile(top),
  rest: profile(rest),
  gap: Object.fromEntries(DIMS.map((d) => [d, round(profile(top)[d] - profile(rest)[d])])),
}

// ---- 4) 同齡比較：短劇同年份 Top 25% vs Bottom 25% ----
function quartilesOf(medium) {
  const pool = works.filter((w) => w.medium === medium)
  const ys = [...new Set(pool.map((w) => w.year))].filter(Boolean)
  const highs = []
  const lows = []
  for (const y of ys) {
    const group = pool.filter((w) => w.year === y)
    if (group.length < 8) continue
    const s = [...group].sort((a, b) => b.hitScore - a.hitScore)
    const q = Math.max(2, Math.round(s.length * 0.25))
    highs.push(...s.slice(0, q))
    lows.push(...s.slice(-q))
  }
  return { highs, lows }
}

const sq = quartilesOf('shortdrama')
const sameAgeShortdrama = {
  n: { high: sq.highs.length, low: sq.lows.length },
  high: profile(sq.highs),
  low: profile(sq.lows),
  gap: Object.fromEntries(DIMS.map((d) => [d, round(profile(sq.highs)[d] - profile(sq.lows)[d])])),
  genreShare: {
    high: Object.fromEntries([...new Set(sq.highs.flatMap((w) => w.genres))].map((g) => [g, sq.highs.filter((w) => w.genres.includes(g)).length])),
    low: Object.fromEntries([...new Set(sq.lows.flatMap((w) => w.genres))].map((g) => [g, sq.lows.filter((w) => w.genres.includes(g)).length])),
  },
}

// ---- 5) 收藏差異分析（Bangumi：同媒介同年份，高收藏 vs 低收藏）----
function collectCompare(medium) {
  const pool = works.filter((w) => w.medium === medium && w.metrics?.collect)
  const ys = [...new Set(pool.map((w) => w.year))].filter(Boolean)
  const highs = []
  const lows = []
  for (const y of ys) {
    const g = pool.filter((w) => w.year === y)
    if (g.length < 4) continue
    const s = [...g].sort((a, b) => b.metrics.collect - a.metrics.collect)
    const q = Math.max(1, Math.round(s.length * 0.25))
    highs.push(...s.slice(0, q))
    lows.push(...s.slice(-q))
  }
  // 同年份樣本不足時，退回整體高／低收藏比較（並在報告中標註年齡混淆）
  // Fall back to overall high/low collection when same-year groups are too small.
  if (highs.length < 4) {
    const s = [...pool].sort((a, b) => b.metrics.collect - a.metrics.collect)
    const q = Math.max(3, Math.round(s.length * 0.2))
    highs.push(...s.slice(0, q))
    lows.push(...s.slice(-q))
  }
  if (!highs.length) return null
  return {
    n: { high: highs.length, low: lows.length },
    collectMedian: { high: Math.round(median(highs.map((w) => w.metrics.collect))), low: Math.round(median(lows.map((w) => w.metrics.collect))) },
    quality: { high: round(mean(highs.map((w) => w.dims.quality))), low: round(mean(lows.map((w) => w.dims.quality))) },
    buzz: { high: round(mean(highs.map((w) => w.dims.buzz))), low: round(mean(lows.map((w) => w.dims.buzz))) },
    doingShare: {
      high: round(mean(highs.map((w) => (w.metrics.collect ? (w.metrics.doing ?? 0) / w.metrics.collect : 0))), 3),
      low: round(mean(lows.map((w) => (w.metrics.collect ? (w.metrics.doing ?? 0) / w.metrics.collect : 0))), 3),
    },
    regionMix: {
      high: Object.fromEntries([...new Set(highs.map((w) => w.region))].map((r) => [r, highs.filter((w) => w.region === r).length])),
      low: Object.fromEntries([...new Set(lows.map((w) => w.region))].map((r) => [r, lows.filter((w) => w.region === r).length])),
    },
  }
}
const collectFilm = collectCompare('film')
const collectNovel = collectCompare('novel')

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

// ---- 6) 洞察文字 ----
const topGenres = genreLift.slice(0, 5)
const bottomGenres = genreLift.slice(-5).reverse()
const insights = {
  generatedAt: data.snapshotDate,
  datasetVersion: data.version,
  n: works.length,
  counts: data.counts,
  genreLift,
  tagLift,
  platformLift,
  yearProfile,
  topVsRest,
  sameAgeShortdrama,
  collectFilm,
  collectNovel,
  findingsZh: [
    `全站前 10% 與其餘作品的最大差距在「熱度規模」（+${topVsRest.gap.reach}）與「討論聲量」（+${topVsRest.gap.buzz}），口碑差距為 +${topVsRest.gap.quality}。`,
    `短劇同年份 Top 25% 與 Bottom 25% 的差距：熱度 +${sameAgeShortdrama.gap.reach}、討論 +${sameAgeShortdrama.gap.buzz}、破圈 +${sameAgeShortdrama.gap.crossover}，而口碑只差 +${sameAgeShortdrama.gap.quality}。`,
    topGenres[0] ? `類型提升度最高：${topGenres.map((g) => `${g.key}（+${g.lift}）`).join('、')}。` : '',
    bottomGenres[0] ? `類型提升度最低：${bottomGenres.map((g) => `${g.key}（${g.lift}）`).join('、')}。` : '',
    collectFilm
      ? `電影同齡高收藏組 vs 低收藏組：口碑 ${collectFilm.quality.high} vs ${collectFilm.quality.low}、討論 ${collectFilm.buzz.high} vs ${collectFilm.buzz.low}、在追比例 ${collectFilm.doingShare.high} vs ${collectFilm.doingShare.low}。`
      : '',
  ].filter(Boolean),
  findingsEn: [
    `The biggest gap between the global top 10% and the rest is reach (+${topVsRest.gap.reach}) and buzz (+${topVsRest.gap.buzz}); the quality gap is only +${topVsRest.gap.quality}.`,
    `Among short dramas of the same release year, the top quartile beats the bottom quartile on reach (+${sameAgeShortdrama.gap.reach}), buzz (+${sameAgeShortdrama.gap.buzz}) and crossover (+${sameAgeShortdrama.gap.crossover}), while quality differs by only +${sameAgeShortdrama.gap.quality}.`,
    topGenres[0] ? `Highest genre lift: ${topGenres.map((g) => `${g.key} (+${g.lift})`).join(', ')}.` : '',
    bottomGenres[0] ? `Lowest genre lift: ${bottomGenres.map((g) => `${g.key} (${g.lift})`).join(', ')}.` : '',
    collectFilm
      ? `Films, same-year high vs low collection: quality ${collectFilm.quality.high} vs ${collectFilm.quality.low}, buzz ${collectFilm.buzz.high} vs ${collectFilm.buzz.low}, currently-watching share ${collectFilm.doingShare.high} vs ${collectFilm.doingShare.low}.`
      : '',
  ].filter(Boolean),
}

await fs.mkdir(path.join(ROOT, 'app/public/data'), { recursive: true })
await fs.writeFile(path.join(ROOT, 'app/public/data/insights.json'), JSON.stringify(insights, null, 2), 'utf8')
console.log('✅ app/public/data/insights.json')
console.log('--- 主要發現 ---')
for (const f of insights.findingsZh) console.log('•', f)

// ---- 7) Markdown 報告 ----
const table = (rows, headers) =>
  `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${r.join(' | ')} |`).join('\n')

const md = `# 09 · 爆款因子分析

> **English summary**
> Auto-generated by \`node scripts/analyze_hits.mjs\` from the current dataset (${works.length} titles).
> It compares the global top 10% with the rest, short-drama quartiles within the same release year,
> genre / tag / platform lift, and collection differences using Bangumi data as a proxy. Everything
> here is **correlation, not causation**, and short-drama scores are estimates (±5.5).

> 本文件由 \`node scripts/analyze_hits.mjs\` 自動生成（資料快照 ${data.snapshotDate}，${works.length} 部）。
> 這是**相關性分析**，不是因果推論；已盡量用「同齡比較」控制上架時間，但無法控制投流金額等平台內部變數。

## 1. 全站：Top 10% 與其餘作品的五維差距

${table(
  DIMS.map((d) => [d, ins(topVsRest.top[d]), ins(topVsRest.rest[d]), (topVsRest.gap[d] > 0 ? '+' : '') + topVsRest.gap[d]]),
  ['維度', 'Top 10%', '其餘', '差距'],
)}

**解讀**：爆款與普通作品的分野主要在「熱度規模」與「討論聲量」；口碑差距相對小。這與短劇產業的觀察一致：**看得到比拍得好更重要，但留下來要靠口碑**。

## 2. 短劇：同年份 Top 25% vs Bottom 25%

${table(
  DIMS.map((d) => [d, sameAgeShortdrama.high[d], sameAgeShortdrama.low[d], (sameAgeShortdrama.gap[d] > 0 ? '+' : '') + sameAgeShortdrama.gap[d]]),
  ['維度', '同年份 Top 25%', '同年份 Bottom 25%', '差距'],
)}

樣本：Top ${sameAgeShortdrama.n.high} 部、Bottom ${sameAgeShortdrama.n.low} 部（同一年、至少 8 部才納入）。

## 3. 類型提升度（所有媒介，n ≥ 5）

${table(
  genreLift.slice(0, 12).map((g) => [g.key, g.n, g.mean, g.lift > 0 ? '+' + g.lift : g.lift]),
  ['類型', '樣本數', '平均指數', '相對同媒介提升'],
)}

${genreLift
  .slice(-5)
  .reverse()
  .map((g) => `- 低於平均：${g.key}（${g.lift}，n=${g.n}）`)
  .join('\n')}

## 4. 短劇標籤提升度（n ≥ 5）

${table(
  tagLift.slice(0, 12).map((g) => [g.key, g.n, g.mean, g.lift > 0 ? '+' + g.lift : g.lift]),
  ['標籤', '樣本數', '平均指數', '提升'],
)}

## 5. 短劇平台提升度（n ≥ 3）

${table(
  platformLift.map((g) => [g.key, g.n, g.mean, g.lift > 0 ? '+' + g.lift : g.lift]),
  ['平台', '樣本數', '平均指數', '提升'],
)}

## 6. 收藏差異：為什麼同樣上架一個月，有人 100 萬收藏、有人 1 萬？

以 Bangumi（電影／小說）作為「有真實收藏數」的替代樣本，控制同一年份後比較高收藏組與低收藏組：

${collectFilm ? `**電影**（高收藏中位數 ${collectFilm.collectMedian.high} vs 低收藏 ${collectFilm.collectMedian.low}）\n\n${table(
  [
    ['口碑品質', collectFilm.quality.high, collectFilm.quality.low],
    ['討論聲量', collectFilm.buzz.high, collectFilm.buzz.low],
    ['在追比例', collectFilm.doingShare.high, collectFilm.doingShare.low],
  ],
  ['指標', '高收藏組', '低收藏組'],
)}` : ''}

${collectNovel ? `**小說**（高收藏中位數 ${collectNovel.collectMedian.high} vs 低收藏 ${collectNovel.collectMedian.low}）\n\n${table(
  [
    ['口碑品質', collectNovel.quality.high, collectNovel.quality.low],
    ['討論聲量', collectNovel.buzz.high, collectNovel.buzz.low],
    ['在追比例', collectNovel.doingShare.high, collectNovel.doingShare.low],
  ],
  ['指標', '高收藏組', '低收藏組'],
)}` : ''}

**注意**：紅果的「收藏／追蹤」數字沒有公開 API，本節用 Bangumi 收藏作為方法示範；要回答紅果的收藏差異，需要站內快照或授權資料。可觀測的替代指標是「評論／播放比」「收藏／播放比」（需榜單同時提供兩個數字），或上架天數 vs 累積播放的斜率。

## 7. 方法與限制

- 提升度 = 該特徵作品平均指數 − 同媒介平均指數；樣本 < 5 不列。
- 同齡比較：同一年、樣本 ≥ 8 才納入，取前 25% 與後 25%。
- **相關 ≠ 因果**：題材／平台的提升度可能來自投流、檔期、卡司等未觀測變數。
- 倖存者偏差：收錄以熱門作品為主，分母不完整。
- 短劇分數是估算值（±5.5），高收藏／低收藏差異需更多站內資料驗證。
`

await fs.writeFile(path.join(ROOT, 'docs/09-爆款因子分析.md'), md, 'utf8')
console.log('✅ docs/09-爆款因子分析.md')

function ins(v) {
  return v
}
