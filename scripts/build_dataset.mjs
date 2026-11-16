#!/usr/bin/env node
/**
 * 建置合併資料集 app/src/data/works.json
 * Build the merged dataset app/src/data/works.json
 *
 * 輸入 / Inputs:
 *   app/src/data/anime.json          — AniList 實測資料 / measured, produced by fetch_anilist.mjs
 *   scripts/seed/shortdrama.json     — 短劇編輯資料（估算 + 公開報導）/ short drama, estimated from public reporting
 *   scripts/seed/novel.json          — 小說編輯資料 / novels, estimated
 *   scripts/seed/film.json           — 電影編輯資料 / films, estimated
 *
 * 模型 / Model: Breakout Index v0.1（五維加權 / five weighted dimensions，見 docs/02）
 *   維度 / dimensions: reach 熱度規模, quality 口碑品質, buzz 討論聲量, momentum 當下動能, crossover 破圈能力
 *   計分 / score: Hit = Σ w_d · dim_d，再依樣本量向 50 做信心收縮 / shrunk toward 50 by sample size
 *   分解 / decomposition: contribution_d = w_d · (dim_d − 50)，Σ contribution = Hit − 50（相對 50 基準的瀑布圖 / waterfall vs. 50 baseline）
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'app/src/data')
const SEED = path.join(ROOT, 'scripts/seed')

const MODEL_VERSION = 'breakout-0.1'
const SNAPSHOT = new Date().toISOString().slice(0, 10)

const WEIGHTS = {
  shortdrama: { reach: 0.26, quality: 0.14, buzz: 0.22, momentum: 0.2, crossover: 0.18 },
  anime: { reach: 0.28, quality: 0.26, buzz: 0.16, momentum: 0.15, crossover: 0.15 },
  novel: { reach: 0.24, quality: 0.24, buzz: 0.2, momentum: 0.17, crossover: 0.15 },
  film: { reach: 0.3, quality: 0.26, buzz: 0.16, momentum: 0.14, crossover: 0.14 },
}

const DIMS = {
  reach: {
    zh: '熱度規模', en: 'Reach',
    descZh: '有多少人接觸到這部作品：播放／觀看、加入清單、評分人數的規模（取對數後與同類作品比較）。',
    descEn: 'How many people the work reached: plays, watchlist adds and rating counts, log-scaled against its cohort.',
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
    descZh: '近 7–30 日的熱度變化速度；爆款看斜率，不看總量。',
    descEn: 'Rate of change over the last 7–30 days. Breakouts are judged by slope, not totals.',
  },
  crossover: {
    zh: '破圈能力', en: 'Crossover',
    descZh: '相對同題材基準線的超出幅度：能否吸引核心圈層以外的觀眾。',
    descEn: 'How far it outperforms its genre baseline — can it reach beyond its core audience?',
  },
}

// ---------------------------------------------------------------- utilities 工具

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function mad(arr) {
  const med = median(arr)
  return median(arr.map((x) => Math.abs(x - med))) || 1
}

// 穩健統計工具 / Robust statistics helpers

// ---------------------------------------------------------------- anime 動漫

const ZH_TITLE = {
  '進撃の巨人': '進擊的巨人',
  '鬼滅の刃': '鬼滅之刃',
  '呪術廻戦': '咒術迴戰',
  'DEATH NOTE': '死亡筆記本',
  '僕のヒーローアカデミア': '我的英雄學院',
  'HUNTER×HUNTER (2011)': '獵人（2011）',
  'ワンパンマン': '一拳超人',
  'ONE PIECE': '航海王',
  '東京喰種 トーキョーグール': '東京喰種',
  'チェンソーマン': '鏈鋸人',
  'SPY×FAMILY': '間諜家家酒',
  'ホリミヤ': '堀與宮村',
  '鬼滅の刃 無限列車編': '鬼滅之刃 無限列車篇',
  '呪術廻戦 第2期': '咒術迴戰 第二季',
  '葬送のフリーレン': '葬送的芙莉蓮',
  '鬼滅の刃 遊郭編': '鬼滅之刃 遊郭篇',
  '無職転生 ～異世界行ったら本気だす～': '無職轉生～到了異世界就拿出真本事～',
  '俺だけレベルアップな件': '我獨自升級',
  '東京リベンジャーズ': '東京復仇者',
  '呪術廻戦 0': '咒術迴戰 0',
  'その着せ替え人形は恋をする': '戀上換裝娃娃',
  'かぐや様は告らせたい？～天才たちの恋愛頭脳戦～': '輝夜姬想讓人告白？',
  '僕のヒーローアカデミア５': '我的英雄學院 第五季',
  'サイバーパンク エッジランナーズ': '電馭叛客：邊緣行者',
  'ダンダダン': '膽大黨',
  'Re:ゼロから始める異世界生活 2nd Season': 'Re:從零開始的異世界生活 第二季',
  '鬼滅の刃 刀鍛冶の里編': '鬼滅之刃 刀匠村篇',
  '地獄楽': '地獄樂',
  '鬼滅の刃 無限列車編 (TV)': '鬼滅之刃 無限列車篇（TV）',
  '薬屋のひとりごと': '藥師少女的獨語',
  'Dr.STONE STONE WARS': '新石紀 STONE WARS',
  '神之塔 -Tower of God-': '神之塔',
  '【推しの子】': '我推的孩子',
  'SPY×FAMILY 第2クール': '間諜家家酒 第二季',
  'ブルーロック': '藍色監獄',
  '86－エイティシックス－': '86－不存在的戰區－',
  '薬屋のひとりごと 第2期': '藥師少女的獨語 第二季',
  '薬屋のひとりごと 第3期': '藥師少女的獨語 第三季',
  'ブラッククローバー 第2期': '黑色五葉草 第二季',
  'アオのハコ Season２': '青春之箱 第二季',
  'ジョジョの奇妙な冒険 スティール・ボール・ラン 2nd＆3rd STAGE': 'JoJo 的奇妙冒險 飆馬野郎',
  'ドラゴンボール超 ビルス': '七龍珠超 比魯斯',
  'アオアシ 第2期': '青之蘆葦 第二季',
  '生徒会にも穴はある！': '學生會也有洞！',
  'テムパル～アイテムの力～': 'Temparu～道具之力～',
}

function animeToWork(a) {
  const m = a.metrics
  return {
    id: a.id,
    medium: 'anime',
    title: {
      zh: ZH_TITLE[a.title.native] ?? a.title.native,
      en: a.title.en || a.title.romaji || a.title.native,
      native: a.title.native,
    },
    year: a.year ?? 0,
    region: 'JP',
    platform: a.studio ?? undefined,
    genres: a.genres ?? [],
    tags: (a.tags ?? []).map((t) => ({ zh: t.name, en: t.name })),
    episodes: a.episodes,
    episodeMinutes: a.duration,
    format: a.format,
    status: a.status,
    dims: null, // 稍後計算
    raw: {
      popularity: m.popularity,
      favourites: m.favourites,
      meanScore: m.meanScore,
      averageScore: m.averageScore,
      ratingCount: (m.scoreDistribution ?? []).reduce((s, x) => s + x.amount, 0),
      trending: m.trending,
    },
    scoreDistribution: m.scoreDistribution,
    provenance: {
      status: 'measured',
      sources: a.provenance.sources,
      note: {
        zh: '評分、人氣、收藏與趨勢為 AniList 公開 API 快照；非平台後台數據。',
        en: 'Scores, popularity, favourites and trend are an AniList public API snapshot — not platform-internal data.',
      },
    },
  }
}

function computeAnimeDims(works) {
  // 絕對刻度（0–100），非同批相對排名 — 讓跨媒介可比
  // Absolute 0–100 scale (not a within-batch rank) so media stay comparable.
  const lin = (v, lo, hi) => clamp((100 * (v - lo)) / (hi - lo), 0, 100)

  const pop = works.map((w) => Math.log10(Math.max(1, w.raw.popularity)))
  const byGenre = new Map()
  works.forEach((w, i) => {
    const g = w.genres[0] ?? 'Other'
    if (!byGenre.has(g)) byGenre.set(g, [])
    byGenre.get(g).push(pop[i])
  })
  const genreMedian = new Map(
    [...byGenre.entries()].map(([g, arr]) => [g, arr.length >= 3 ? median(arr) : median(pop)]),
  )

  works.forEach((w, i) => {
    const n = w.raw.ratingCount
    const s = w.raw.meanScore ?? 78
    const bayes = (n * s + 500 * 78) / (n + 500) // 貝氏加權評分 / Bayesian weighted rating，m=500，C=78
    const g = w.genres[0] ?? 'Other'
    const excess = pop[i] - genreMedian.get(g)

    w.dims = {
      reach: round1(lin(pop[i], 3.3, 5.9)),
      quality: round1(lin(bayes, 58, 90)),
      buzz: round1(lin(Math.log10(n + 1), 3.4, 5.9)),
      momentum: round1(lin(Math.log10(w.raw.trending + 1), 1.3, 2.7)),
      crossover: round1(lin(excess, -0.5, 0.8)),
    }
    w.rawAnalytics = {
      popularity: w.raw.popularity,
      ratingCount: n,
      bayesianScore: round1(bayes),
      genreBaselineLogPop: round1(genreMedian.get(g) * 100) / 100,
      excessLogPop: round1(excess * 100) / 100,
    }
  })
}

const round1 = (x) => Math.round(x * 10) / 10

const GENRE_ZH = {
  Action: '動作', Adventure: '冒險', Comedy: '喜劇', Drama: '劇情', Fantasy: '奇幻',
  Horror: '恐怖', Mecha: '機甲', Music: '音樂', Mystery: '懸疑', Psychological: '心理',
  Romance: '戀愛', 'Sci-Fi': '科幻', 'Slice of Life': '日常', Sports: '運動',
  Supernatural: '超自然', Thriller: '驚悚', Ecchi: '擦邊', 'Mahou Shoujo': '魔法少女',
}

// ---------------------------------------------------------------- seeds 編輯資料

function seedToWork(s) {
  const w = {
    ...s,
    contributions: undefined,
    provenance: {
      ...s.provenance,
      sources: s.provenance?.sources ?? [],
    },
  }
  return w
}

// ---------------------------------------------------------------- score 計分

function scoreWork(w) {
  const weights = WEIGHTS[w.medium]
  const dims = w.dims
  const hitRaw = Object.entries(weights).reduce((s, [k, wt]) => s + dims[k] * wt, 0)

  // 動漫以 AniList 評分樣本量做輕微收縮；編輯估算資料不雙重懲罰，但給較寬區間與低信心
  // Anime is lightly shrunk by AniList rating count; editorial estimates are not double-penalised
  // but get a wider interval and low confidence.
  let lambda = 1
  let nEff = 0
  if (w.medium === 'anime' && w.raw) {
    nEff = w.raw.ratingCount
    lambda = Math.max(0.93, nEff / (nEff + 600))
  }
  const hit = 50 + (hitRaw - 50) * lambda

  w.hitScore = round1(clamp(hit, 0, 100))
  // 貢獻度與 hitScore 必須可加總：套用同樣的收縮係數 λ。
  // Contributions must add up to the score: apply the same shrinkage factor λ.
  w.contributions = Object.entries(weights).map(([k, wt]) => ({
    key: k,
    points: round1(wt * (dims[k] - 50) * lambda),
  }))

  const delta =
    w.provenance.status === 'measured'
      ? clamp(120 / Math.sqrt(Math.max(500, nEff)) * 18, 0.8, 6)
      : 5.5
  w.ci = [round1(clamp(w.hitScore - delta, 0, 100)), round1(clamp(w.hitScore + delta, 0, 100))]
  w.confidence =
    w.provenance.status === 'measured' ? (nEff > 20000 ? 'high' : 'medium') : 'low'

  if (!w.synopsis) {
    const zhGenres = w.genres.slice(0, 2).map((g) => GENRE_ZH[g] ?? g).join('／')
    const enGenres = w.genres.slice(0, 2).join(' / ').toLowerCase()
    const airing = w.status === 'RELEASING'
    w.synopsis = {
      zh: `${w.year} 年${airing ? '開播、仍在連載' : '推出'}的${zhGenres}動畫${w.platform ? `，由 ${w.platform} 製作` : ''}${w.episodes ? `，全 ${w.episodes} 集` : ''}。`,
      en: `An ${airing ? 'ongoing' : ''} ${enGenres} anime${airing ? ` that premiered in ${w.year}` : ` from ${w.year}`}${w.platform ? ` by ${w.platform}` : ''}${w.episodes ? `, ${w.episodes} episodes` : ''}.`,
    }
  }
  if (!w.drivers) w.drivers = []
  return w
}

// ---------------------------------------------------------------- main 主流程

async function readJsonIfExists(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const animeRaw = JSON.parse(await fs.readFile(path.join(DATA, 'anime.json'), 'utf8'))
  const animeWorks = animeRaw.items.map(animeToWork)
  computeAnimeDims(animeWorks)

  const seeds = []
  for (const [file, medium] of [
    ['shortdrama.json', 'shortdrama'],
    ['novel.json', 'novel'],
    ['film.json', 'film'],
  ]) {
    const doc = await readJsonIfExists(path.join(SEED, file))
    if (!doc) {
      console.warn(`⚠️  seed missing: ${file}`)
      continue
    }
    for (const s of doc.items) seeds.push(seedToWork({ ...s, medium: s.medium ?? medium }))
  }

  const works = [...animeWorks, ...seeds].map(scoreWork)
  works.sort((a, b) => b.hitScore - a.hitScore)

  const out = {
    dataset: 'breakout-v0.1',
    version: '0.1.0',
    snapshotDate: SNAPSHOT,
    modelVersion: MODEL_VERSION,
    citation: `Breakout Index (${MODEL_VERSION}). (${SNAPSHOT}). 破圈資料集 v0.1 [Data set].`,
    weights: WEIGHTS,
    dims: DIMS,
    works,
  }
  await fs.writeFile(path.join(DATA, 'works.json'), JSON.stringify(out, null, 2), 'utf8')
  const byMedium = works.reduce((m, w) => ((m[w.medium] = (m[w.medium] ?? 0) + 1), m), {})
  console.log(`✅ works.json: ${works.length} works`, byMedium)
  console.log('   top5:', works.slice(0, 5).map((w) => `${w.title.zh} ${w.hitScore}`).join(' | '))
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
