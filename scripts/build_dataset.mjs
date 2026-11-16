#!/usr/bin/env node
/**
 * 建置合併資料集 app/public/data/works.json
 * Build the merged dataset app/public/data/works.json
 *
 * 輸入 / Inputs:
 *   app/src/data/anime.json        — AniList 實測 / measured (fetch_anilist.mjs)
 *   app/src/data/bangumi-novel.json— Bangumi 實測 / measured (fetch_bangumi.mjs)
 *   app/src/data/bangumi-film.json — Bangumi 實測 / measured (fetch_bangumi.mjs)
 *   scripts/seed/shortdrama.json   — 短劇編輯資料 / short drama, estimated
 *   scripts/seed/novel.json        — 華語小說編輯資料 / Chinese web novels, estimated
 *   scripts/seed/film.json         — 華語電影編輯資料 / Chinese films, estimated
 *
 * 模型 / Model: Breakout Index v0.1（五維加權 / five weighted dimensions，見 docs/02）
 *   維度 / dims: reach 熱度規模, quality 口碑品質, buzz 討論聲量, momentum 當下動能, crossover 破圈能力
 *   計分 / score: Hit = Σ w_d · dim_d，再依樣本量向 50 做信心收縮 / shrunk toward 50
 *   分解 / decomposition: contribution_d = w_d · (dim_d − 50) · λ，Σ contribution = Hit − 50
 *
 * 估算 SOP / Estimation SOP（短劇與華語編輯資料）:
 *   每個 seed 提供 anchors（plays / dataeyeRank / heatValue / criticScore / buzzLevel /
 *   launchDate / awards / genreBreakout），由本檔的 anchor 函式換算成 0–100 維度，
 *   因此「估算」是可重算、可審核的，而不是手動填分數。
 *   Each seed provides anchors; deterministic functions below turn them into dimensions,
 *   so estimates are reproducible and auditable rather than hand-typed.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'app/src/data')
const PUBLIC = path.join(ROOT, 'app/public/data')
const SEED = path.join(ROOT, 'scripts/seed')

const MODEL_VERSION = 'breakout-0.2'
const SNAPSHOT = new Date().toISOString().slice(0, 10)

// 繁簡轉換 / Simplified → Traditional conversion
const toTW = OpenCC.Converter({ from: 'cn', to: 'tw' })
const tw = (s) => (s ? toTW(String(s)) : s)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round1 = (x) => Math.round(x * 10) / 10
const scale = (v, lo, hi) => clamp((100 * (v - lo)) / (hi - lo), 0, 100)
const log10 = (x) => Math.log10(Math.max(1, x))

const WEIGHTS = {
  shortdrama: { reach: 0.26, quality: 0.14, buzz: 0.22, momentum: 0.2, crossover: 0.18 },
  anime: { reach: 0.28, quality: 0.26, buzz: 0.16, momentum: 0.15, crossover: 0.15 },
  novel: { reach: 0.24, quality: 0.24, buzz: 0.2, momentum: 0.17, crossover: 0.15 },
  film: { reach: 0.3, quality: 0.26, buzz: 0.16, momentum: 0.14, crossover: 0.14 },
}

const DIMS = {
  reach: {
    zh: '熱度規模', en: 'Reach',
    descZh: '有多少人接觸到這部作品：播放／觀看、加入清單、評分人數的規模（取對數後換算 0–100）。',
    descEn: 'How many people the work reached: plays, watchlist adds and rating counts, log-scaled to 0–100.',
  },
  quality: {
    zh: '口碑品質', en: 'Quality',
    descZh: '貝氏收縮後的評分（向母體均值收縮，避免小樣本高分奪冠）。',
    descEn: 'Bayesian-shrunk rating: small-sample scores are pulled toward the cohort mean.',
  },
  buzz: {
    zh: '討論聲量', en: 'Buzz',
    descZh: '社群參與度：評分人數、短評與彈幕、二創與搜尋的增量斜率。',
    descEn: 'Community participation: rating volume, reviews, danmaku, fanwork and search slope.',
  },
  momentum: {
    zh: '當下動能', en: 'Momentum',
    descZh: '近期熱度變化速度；爆款看斜率，不看總量。',
    descEn: 'Recent rate of change. Breakouts are judged by slope, not totals.',
  },
  crossover: {
    zh: '破圈能力', en: 'Crossover',
    descZh: '討論與核心粉絲參與「超出觀看規模」的幅度（已對 reach 正交化）：能否吸引核心圈層以外的注意力。',
    descEn: 'Discussion and core-fan engagement in excess of audience size, orthogonalised against reach: can it attract attention beyond its core audience?',
  },
}

const MEDIUM_ZH = { shortdrama: '短劇', anime: '動畫', novel: '小說', film: '電影' }
const MEDIUM_EN = { shortdrama: 'short drama', anime: 'anime', novel: 'novel', film: 'film' }
const REGION_ZH = { CN: '中國', JP: '日本', KR: '韓國', US: '美國', HK: '香港', TW: '台灣', FR: '法國', GB: '英國', DE: '德國', IT: '義大利', ES: '西班牙', IN: '印度', GLOBAL: '國際' }
const REGION_EN = { CN: 'Chinese', JP: 'Japanese', KR: 'Korean', US: 'American', HK: 'Hong Kong', TW: 'Taiwanese', FR: 'French', GB: 'British', DE: 'German', IT: 'Italian', ES: 'Spanish', IN: 'Indian', GLOBAL: 'international' }

// 中文標籤 → 標準化類型 / Chinese tag → canonical genre
const TAG2GENRE = {
  奇幻: 'Fantasy', 科幻: 'Sci-Fi', 推理: 'Mystery', 悬疑: 'Suspense', 懸疑: 'Suspense',
  恐怖: 'Horror', 恋爱: 'Romance', 戀愛: 'Romance', 爱情: 'Romance', 愛情: 'Romance',
  战斗: 'Action', 戰鬥: 'Action', 动作: 'Action', 動作: 'Action', 喜剧: 'Comedy', 喜劇: 'Comedy',
  剧情: 'Drama', 劇情: 'Drama', 历史: 'Historical', 歷史: 'Historical', 战争: 'War', 戰爭: 'War',
  犯罪: 'Crime', 青春: 'Youth', 校园: 'School', 校園: 'School', 日常: 'Slice of Life',
  动画: 'Animation', 動畫: 'Animation', 武侠: 'Wuxia', 武俠: 'Wuxia', 仙侠: 'Xianxia', 仙俠: 'Xianxia',
  惊悚: 'Thriller', 驚悚: 'Thriller', 音乐: 'Music', 音樂: 'Music', 运动: 'Sports', 運動: 'Sports',
  家庭: 'Family', 冒险: 'Adventure', 冒險: 'Adventure', 治愈: 'Iyashikei', 治癒: 'Iyashikei',
  耽美: 'BL', 后宫: 'Harem', 後宮: 'Harem', 偶像: 'Idol', 美食: 'Food', 职场: 'Work', 職場: 'Work',
}

function genresFromTags(tags) {
  const out = new Set()
  for (const t of tags) {
    const g = TAG2GENRE[t] ?? TAG2GENRE[tw(t)]
    if (g) out.add(g)
  }
  return [...out].slice(0, 5)
}

// ---------------------------------------------------------------- 正交化 / orthogonalisation

const meanOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const sdOf = (a) => {
  const m = meanOf(a)
  return Math.sqrt(meanOf(a.map((v) => (v - m) ** 2))) || 1
}
const zs = (a) => {
  const m = meanOf(a)
  const sd = sdOf(a)
  return a.map((v) => (v - m) / sd)
}

/** 對 x 做線性回歸、取殘差：讓 y 與 x 正交 / residualise y on x so the result is orthogonal to x */
function residualise(y, x) {
  const mx = meanOf(x)
  const my = meanOf(y)
  let cov = 0
  let varx = 0
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - mx) * (y[i] - my)
    varx += (x[i] - mx) ** 2
  }
  const slope = varx ? cov / varx : 0
  const intercept = my - slope * mx
  return y.map((v, i) => v - (intercept + slope * x[i]))
}

/**
 * v0.2 破圈維度：以「討論／參與相對觀看規模的超出」為訊號，並對 reach 正交化。
 * v0.2 crossover: discussion/engagement in excess of audience size, orthogonalised against reach.
 * 這樣可避免舊版 crossover 與 reach 相關 0.82 的冗餘。
 * This removes the v0.1 redundancy where crossover correlated ~0.82 with reach.
 */
function computeCrossoverAll(works) {
  for (const medium of ['anime', 'novel', 'film', 'shortdrama']) {
    const group = works.filter((w) => w.medium === medium)
    if (group.length < 3) continue
    const zReach = zs(group.map((w) => w.dims.reach))
    const zBuzz = zs(group.map((w) => w.dims.buzz))
    const raw = group.map((w, i) => {
      const tagBreadth = Math.min(1, (w.tags?.length ?? 0) / 8)
      let bonus = 0.25 * (tagBreadth - 0.5)
      if (medium === 'shortdrama') {
        const a = w.estimate ?? {}
        if (a.genreBreakout) bonus += 0.5
      }
      return zBuzz[i] - zReach[i] + bonus
    })
    const orth = residualise(raw, zReach)
    const zOrth = zs(orth)
    // 用 logistic 映射到 0–100，避免 z 截斷造成大量 100 分。
    // Logistic mapping avoids clipping a large share of titles at 100.
    group.forEach((w, i) => {
      w.dims.crossover = round1(100 / (1 + Math.exp(-zOrth[i])))
    })
  }
}

// ---------------------------------------------------------------- 共用計分 / scoring

function scoreWork(w) {
  const weights = WEIGHTS[w.medium]
  const dims = w.dims
  const hitRaw = Object.entries(weights).reduce((s, [k, wt]) => s + dims[k] * wt, 0)

  // 樣本收縮：只對 measured 且有評分樣本的作品做輕微收縮。
  // Sample shrinkage: only for measured records with rating counts.
  let lambda = 1
  let nEff = 0
  if (w.provenance.status === 'measured' && w.metrics?.ratingCount) {
    nEff = w.metrics.ratingCount
    lambda = Math.max(0.93, nEff / (nEff + 600))
  }
  const hit = 50 + (hitRaw - 50) * lambda

  w.hitScore = round1(clamp(hit, 0, 100))
  w.contributions = Object.entries(weights).map(([k, wt]) => ({
    key: k,
    points: round1(wt * (dims[k] - 50) * lambda),
  }))

  const delta =
    w.provenance.status === 'measured'
      ? clamp(2160 / Math.sqrt(Math.max(100, nEff)), 0.8, 6)
      : 5.5
  w.ci = [round1(clamp(w.hitScore - delta, 0, 100)), round1(clamp(w.hitScore + delta, 0, 100))]
  w.confidence =
    w.provenance.status === 'measured' ? (nEff > 500 ? 'high' : 'medium') : 'low'
  if (!w.synopsis) {
    const regionZh = REGION_ZH[w.region] ?? w.region
    w.synopsis = {
      zh: `${w.year || '未知年份'} 年${regionZh}${MEDIUM_ZH[w.medium]}${w.platform ? `，${w.platform}` : ''}${w.episodes ? `，全 ${w.episodes} ${w.medium === 'novel' ? '卷' : '集'}` : ''}。`,
      en: `A ${w.year || ''} ${REGION_EN[w.region] ?? ''} ${MEDIUM_EN[w.medium]}${w.platform ? ` by ${w.platform}` : ''}${w.episodes ? `, ${w.episodes} ${w.medium === 'novel' ? 'volumes' : 'episodes'}` : ''}.`.replace('  ', ' '),
    }
  }
  if (!w.drivers) w.drivers = []
  return w
}

// ---------------------------------------------------------------- 動漫 / anime

const ZH_TITLE = {
  '進撃の巨人': '進擊的巨人', '鬼滅の刃': '鬼滅之刃', '呪術廻戦': '咒術迴戰', 'DEATH NOTE': '死亡筆記本',
  '僕のヒーローアカデミア': '我的英雄學院', 'HUNTER×HUNTER (2011)': '獵人（2011）', 'ワンパンマン': '一拳超人',
  'ONE PIECE': '航海王', '東京喰種 トーキョーグール': '東京喰種', 'チェンソーマン': '鏈鋸人',
  'SPY×FAMILY': '間諜家家酒', 'ホリミヤ': '堀與宮村', '葬送のフリーレン': '葬送的芙莉蓮',
  '鬼滅の刃 無限列車編': '鬼滅之刃 無限列車篇', '呪術廻戦 第2期': '咒術迴戰 第二季',
  '無職転生 ～異世界行ったら本気だす～': '無職轉生～到了異世界就拿出真本事～', '俺だけレベルアップな件': '我獨自升級',
  '東京リベンジャーズ': '東京復仇者', '呪術廻戦 0': '咒術迴戰 0', 'その着せ替え人形は恋をする': '戀上換裝娃娃',
  'ダンダダン': '膽大黨', 'サイバーパンク エッジランナーズ': '電馭叛客：邊緣行者', '薬屋のひとりごと': '藥師少女的獨語',
  '【推しの子】': '我推的孩子', 'ブルーロック': '藍色監獄', '86－エイティシックス－': '86－不存在的戰區－',
  '地獄楽': '地獄樂', '神之塔 -Tower of God-': '神之塔', 'Dr.STONE STONE WARS': '新石紀 STONE WARS',
  'かぐや様は告らせたい？～天才たちの恋愛頭脳戦～': '輝夜姬想讓人告白？', '鬼滅の刃 遊郭編': '鬼滅之刃 遊郭篇',
  '鬼滅の刃 刀鍛冶の里編': '鬼滅之刃 刀匠村篇', '鬼滅の刃 柱稽古編': '鬼滅之刃 柱訓練篇',
  '進撃の巨人 The Final Season': '進擊的巨人 The Final Season',
  '進撃の巨人 The Final Season Part 2': '進擊的巨人 The Final Season Part 2',
  '進撃の巨人 The Final Season 完結編': '進擊的巨人 The Final Season 完結篇',
  'SPY×FAMILY 第2クール': '間諜家家酒 第二季', '僕のヒーローアカデミア５': '我的英雄學院 第五季',
  'Re:ゼロから始める異世界生活 2nd Season': 'Re:從零開始的異世界生活 第二季',
}

function animeToWork(a) {
  const m = a.metrics
  return {
    id: a.id,
    medium: 'anime',
    title: { zh: ZH_TITLE[a.title.native] ?? a.title.native, en: a.title.en, native: a.title.native },
    year: a.year ?? 0,
    region: a.country ?? 'JP',
    platform: a.studio ?? undefined,
    genres: a.genres ?? [],
    tags: (a.tags ?? []).map((t) => ({ zh: t.name, en: t.name })),
    episodes: a.episodes,
    episodeMinutes: a.duration,
    format: a.format,
    status: a.status,
    metrics: m,
    scoreDistribution: (m.scoreDistribution ?? []).map((s) => ({ score: s.score, amount: s.amount })),
    provenance: a.provenance,
  }
}

function computeAnimeDims(works) {
  for (const w of works) {
    const n = w.metrics.ratingCount || 1
    const s = w.metrics.meanScore ?? 78
    const favRate = Math.log((w.metrics.favourites + 1) / (w.metrics.popularity + 1))
    const bayes = (n * s + 500 * 78) / (n + 500)
    w.dims = {
      reach: round1(scale(log10(w.metrics.popularity), 3.3, 5.9)),
      quality: round1(scale(bayes, 58, 90)),
      buzz: round1(0.6 * scale(log10(n), 3.4, 5.9) + 0.4 * scale(favRate, -3.2, -2.2)),
      momentum: round1(scale(log10(w.metrics.trending + 1), 1.3, 2.7)),
      crossover: 50,
    }
    w.metrics.bayesianScore = round1(bayes)
  }
  // 破圈：相對同類型（genres[0]）的熱度超出幅度 / reach excess vs. primary-genre median
  const byGenre = new Map()
  works.forEach((w) => {
    const g = w.genres[0] ?? 'Other'
    if (!byGenre.has(g)) byGenre.set(g, [])
    byGenre.get(g).push(log10(w.metrics.popularity))
  })
  const medians = new Map([...byGenre.entries()].map(([g, arr]) => [g, median(arr)]))
  const global = median([...works.map((w) => log10(w.metrics.popularity))])
  for (const w of works) {
    const g = w.genres[0] ?? 'Other'
    const excess = log10(w.metrics.popularity) - (medians.get(g) ?? global)
    w.dims.crossover = round1(clamp(50 + 55 * excess, 0, 100))
  }
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ---------------------------------------------------------------- Bangumi（小說／電影）

function bangumiToWork(b, medium) {
  const tags = (b.tags ?? []).map((t) => tw(t.zh))
  const genres = genresFromTags(tags)
  const volumes = b.episodes ?? null
  const regionZh = REGION_ZH[b.country] ?? b.country
  const year = b.year ?? 0
  return {
    id: b.id,
    medium,
    title: { zh: tw(b.title.zh), en: b.title.en },
    year,
    region: b.country,
    platform: b.platform ?? undefined,
    genres: genres.length ? genres : [medium === 'film' ? 'Drama' : 'Fantasy'],
    tags: tags.slice(0, 8).map((t) => ({ zh: t, en: t })),
    episodes: volumes,
    episodeMinutes: null,
    date: b.date ?? null,
    status: 'FINISHED',
    metrics: b.metrics,
    scoreDistribution: b.metrics.distribution
      ? Object.entries(b.metrics.distribution).map(([score, amount]) => ({ score: Number(score), amount }))
      : undefined,
    synopsis: {
      zh: `${year || '未知年份'} 年${regionZh}${MEDIUM_ZH[medium]}${volumes ? `，全 ${volumes} 卷` : ''}。`,
      en: `A ${regionZh ? REGION_EN[b.country] : ''} ${MEDIUM_EN[medium]}${year ? ` from ${year}` : ''}${volumes ? `, ${volumes} volumes` : ''}.`,
    },
    provenance: b.provenance,
  }
}

function computeBangumiDims(works) {
  for (const w of works) {
    const n = w.metrics.ratingCount || 1
    const s = w.metrics.score ?? 7.2
    const audience = (w.metrics.collect ?? 0) + 0.3 * (w.metrics.wish ?? 0) + 0.2 * n
    const bayes = (n * s + 300 * (w.medium === 'novel' ? 8 : 7.2)) / (n + 300)
    const doingShare = w.metrics.collect ? clamp((w.metrics.doing ?? 0) / w.metrics.collect, 0, 1) : 0
    // 以「上線月份」計算動能，避免同年度作品全部同分。
    // Momentum uses months since release so titles from the same year do not all tie.
    const monthsAgo = w.date ? Math.max(0, (new Date(SNAPSHOT) - new Date(w.date)) / (1000 * 60 * 60 * 24 * 30.4)) : 24
    const recency = Math.exp(-monthsAgo / 30)

    w.dims = {
      reach: round1(scale(log10(audience), w.medium === 'novel' ? 2.3 : 2.0, w.medium === 'novel' ? 3.8 : 3.7)),
      quality: round1(scale(bayes, w.medium === 'novel' ? 6.8 : 6.2, 9.2)),
      buzz: round1(scale(log10(n), 1.8, 3.6)),
      momentum: round1(clamp(15 + 70 * recency + 30 * doingShare, 0, 95)),
      crossover: 50,
    }
  }

  // 破圈：相對同地區基準線 / excess vs. regional baseline
  for (const w of works) {
    const arr = works.filter((x) => x.region === w.region).map((x) => x.dims.reach)
    const base = arr.length >= 5 ? median(arr) : median(works.map((x) => x.dims.reach))
    w.dims.crossover = round1(clamp(50 + (w.dims.reach - base) * 0.9, 0, 100))
  }
}

// ---------------------------------------------------------------- 短劇／華語編輯資料

const DEFAULT_DRIVER = (w, anchors) => {
  const parts = []
  if (anchors.dataeyeRank) parts.push(`DataEye 年度熱力榜第 ${anchors.dataeyeRank} 名`)
  if (anchors.plays) parts.push(`全網播放約 ${(anchors.plays / 1e8).toFixed(1)} 億`)
  if (anchors.heatValue) parts.push(`熱力值 ${anchors.heatValue} 萬`)
  if (anchors.criticScore) parts.push(`口碑約 ${anchors.criticScore}/10`)
  if (!parts.length) return []
  return [
    {
      text: {
        zh: `公開報導訊號：${parts.join('、')}。`,
        en: `Public signals: ${parts.join(', ')}.`,
      },
    },
  ]
}

/** 錨點 → 維度（估算 SOP）/ anchors → dimensions (estimation SOP) */
function estimateFromAnchors(seed) {
  const a = seed.estimate ?? {}
  const year = seed.year ?? 2024
  const monthsAgo = a.launchDate
    ? Math.max(0, (new Date(SNAPSHOT) - new Date(a.launchDate)) / (1000 * 60 * 60 * 24 * 30.4))
    : Math.max(0, (2026 - year) * 12)

  // reach: 取「播放量換算」「熱力值換算」「榜單名次換算」三者最大值
  // Reach: take the max of play-based, heat-based and rank-based conversions.
  const reachCandidates = []
  if (a.plays) reachCandidates.push(55 + 15 * Math.log10(a.plays / 1e7 + 1))
  if (a.heatValue) {
    // 熱力值（萬）以觀測區間 800–20,200 對數映射到 55–97
    // Heat value (in 10k) mapped log-linearly from 800–20,200 to 55–97.
    reachCandidates.push(55 + 42 * ((Math.log10(a.heatValue) - 2.903) / 1.402))
  }
  if (a.dataeyeRank) reachCandidates.push(50 + 47 * (1 - (a.dataeyeRank - 1) / 99))
  const reach = reachCandidates.length ? Math.max(...reachCandidates) : 58

  // quality: 口碑分 + 獎項
  let quality = a.criticScore ? 50 + (a.criticScore - 6) * 13 : 70
  if (a.awards) quality += Math.min(8, a.awards * 4)

  // buzz: 話題強度 > 榜單名次
  let buzz = a.buzzLevel != null ? 40 + 55 * a.buzzLevel : a.dataeyeRank ? 45 + 50 * (1 - (a.dataeyeRank - 1) / 99) : reach * 0.85

  // momentum: 上線時間衰減（半衰期約 18 個月）
  // Momentum: recency decay with an ~18-month half-life.
  let momentum = 18 + 70 * Math.exp(-monthsAgo / 18)

  // crossover: 題材破圈標記，否則跟隨熱度
  let crossover = a.genreBreakout ? 84 : 55 + (reach - 60) * 0.45

  return {
    dims: {
      reach: round1(clamp(reach, 0, 100)),
      quality: round1(clamp(quality, 0, 100)),
      buzz: round1(clamp(buzz, 0, 100)),
      momentum: round1(clamp(momentum, 0, 100)),
      crossover: round1(clamp(crossover, 0, 100)),
    },
    method: a.plays
      ? 'plays-anchored'
      : a.heatValue
        ? 'heat-anchored'
        : a.dataeyeRank
          ? 'rank-anchored'
          : 'baseline',
  }
}

function seedToWork(s) {
  const dims = s.dims ?? estimateFromAnchors(s).dims
  const method = s.dims ? 'editorial' : estimateFromAnchors(s).method
  const regionZh = REGION_ZH[s.region] ?? s.region
  return {
    ...s,
    genres: s.genres ?? genresFromTags((s.tags ?? []).map((t) => t.zh)),
    tags: s.tags ?? [],
    synopsis:
      s.synopsis ?? {
        zh: `${s.year} 年${regionZh}${MEDIUM_ZH[s.medium] ?? ''}${s.platform ? `，${s.platform}` : ''}。`,
        en: `A ${s.year} ${REGION_EN[s.region] ?? ''} ${MEDIUM_EN[s.medium] ?? ''}${s.platform ? ` on ${s.platform}` : ''}.`,
      },
    dims,
    provenance: {
      ...s.provenance,
      sources: s.provenance?.sources ?? [],
      note: s.provenance?.note ?? {
        zh: `依公開報導的錨點估算（方法：${method}），非平台後台數據。`,
        en: `Estimated from public reporting anchors (method: ${method}); not platform-internal data.`,
      },
    },
    drivers: s.drivers ?? DEFAULT_DRIVER(s, s.estimate ?? {}),
    estimateMethod: method,
    // 去重優先序：measured > 手動編輯維度 > 錨點估算
    // De-duplication priority: measured > manually curated dims > anchor estimates
    _priority: s.provenance?.status === 'measured' ? 0 : s.dims ? 1 : 2,
  }
}

// ---------------------------------------------------------------- main

async function readJson(p, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return fallback
  }
}

async function main() {
  const animeRaw = await readJson(path.join(SRC, 'anime.json'), { items: [] })
  const novelRaw = await readJson(path.join(SRC, 'bangumi-novel.json'), { items: [] })
  const filmRaw = await readJson(path.join(SRC, 'bangumi-film.json'), { items: [] })

  const anime = (animeRaw.items ?? []).map(animeToWork)
  computeAnimeDims(anime)

  const novels = (novelRaw.items ?? []).map((b) => bangumiToWork(b, 'novel'))
  const films = (filmRaw.items ?? []).map((b) => bangumiToWork(b, 'film'))
  computeBangumiDims(novels)
  computeBangumiDims(films)

  const seeds = []
  for (const [file, medium] of [
    ['shortdrama.json', 'shortdrama'],
    ['shortdrama-extra.json', 'shortdrama'],
    ['shortdrama-2023.json', 'shortdrama'],
    ['shortdrama-extra-2.json', 'shortdrama'],
    ['shortdrama-extra-3.json', 'shortdrama'],
    ['shortdrama-extra-4.json', 'shortdrama'],
    ['shortdrama-extra-5.json', 'shortdrama'],
    ['novel.json', 'novel'],
    ['film.json', 'film'],
  ]) {
    const doc = await readJson(path.join(SEED, file))
    if (!doc) {
      console.warn(`⚠️  seed missing: ${file}`)
      continue
    }
    for (const s of doc.items) seeds.push(seedToWork({ medium, ...s }))
  }

  // 套用人工查證的平台／出品方補充 / apply verified platform & producer metadata
  const patch = await readJson(path.join(SEED, 'metadata-patch.json'), { items: [] })
  const patchMap = new Map((patch.items ?? []).map((x) => [x.title, x]))
  for (const w of [...novels, ...films, ...seeds]) {
    const fix = patchMap.get(w.title?.zh)
    if (!fix) continue
    w.platform = fix.platform
    w.provenance.sources = [...(w.provenance.sources ?? []), ...(fix.sources ?? [])]
  }

  const merged = [...anime, ...novels, ...films, ...seeds]
  computeCrossoverAll(merged) // v0.2：正交化破圈維度 / orthogonalised crossover
  const works = merged.map(scoreWork)
  // 去重：先比 id，再比正規化標題（同作品可能有不同來源）/ de-dup by id, then by normalised title
  const normTitle = (t) => String(t ?? '').toLowerCase().replace(/[\s·・:：,，.。!！?？、\-_／/()（）「」『』\[\]【】]/g, '')
  const uniq = new Map()
  for (const w of works) {
    const key = normTitle(w.title.zh) || w.id
    const prev = uniq.get(key)
    if (!prev || (w._priority ?? 3) < (prev._priority ?? 3)) uniq.set(key, w)
  }
  const finalWorks = [...uniq.values()]
    .map((w) => {
      delete w._priority
      return w
    })
    .sort((a, b) => b.hitScore - a.hitScore)

  const sources = new Set()
  finalWorks.forEach((w) => w.provenance.sources.forEach((s) => sources.add(s.url ?? s.name)))

  const out = {
    dataset: 'breakout-v0.1',
    version: '0.3.0',
    snapshotDate: SNAPSHOT,
    modelVersion: MODEL_VERSION,
    citation: `Breakout Index (${MODEL_VERSION}). (${SNAPSHOT}). 破圈資料集 v0.3 [Data set].`,
    weights: WEIGHTS,
    dims: DIMS,
    counts: finalWorks.reduce((m, w) => ((m[w.medium] = (m[w.medium] ?? 0) + 1), m), {}),
    sourceCount: sources.size,
    works: finalWorks,
  }

  await fs.mkdir(PUBLIC, { recursive: true })
  await fs.writeFile(path.join(PUBLIC, 'works.json'), JSON.stringify(out), 'utf8')
  console.log(`✅ works.json: ${finalWorks.length} works`, out.counts, `sources=${sources.size}`)
  console.log('   top5:', finalWorks.slice(0, 5).map((w) => `${w.title.zh} ${w.hitScore}`).join(' | '))
  // 地區 × 媒介統計，供榜單頁除錯 / region × medium stats for the boards page
  const board = {}
  finalWorks.forEach((w) => {
    board[`${w.medium}/${w.region}`] = (board[`${w.medium}/${w.region}`] ?? 0) + 1
  })
  const big = Object.entries(board).filter(([, n]) => n >= 10).sort((a, b) => b[1] - a[1])
  console.log('   boards(>=10):', big.map(([k, n]) => `${k}:${n}`).join(', '))
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
