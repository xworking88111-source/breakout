#!/usr/bin/env node
/**
 * 從 AniList 公開 GraphQL API 抓取動畫資料（目標約 650 部），輸出 app/src/data/anime.json
 * Fetch ~650 anime from the public AniList GraphQL API into app/src/data/anime.json
 *
 * 用法 / Usage: node scripts/fetch_anilist.mjs
 *
 * 資料來源 / Source: https://anilist.co (public GraphQL API, free, no key)
 * 授權 / Licence: community-contributed data; non-commercial prototype. Verify terms before production.
 * 封面圖不使用（改用排版式海報）/ cover images are not used (typographic posters instead).
 */

import fs from 'node:fs/promises'

const ENDPOINT = 'https://graphql.anilist.co'
const SNAPSHOT = new Date().toISOString().slice(0, 10)
const DELAY_MS = 900 // 禮貌性延遲，避免觸發限流 / polite delay to stay under rate limits

const QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $from: FuzzyDateInt, $to: FuzzyDateInt, $country: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage total }
    media(type: ANIME, sort: $sort, isAdult: false,
          startDate_greater: $from, startDate_lesser: $to,
          countryOfOrigin: $country,
          format_in: [TV, MOVIE, ONA]) {
      id
      title { romaji english native }
      countryOfOrigin
      seasonYear
      episodes
      duration
      format
      status
      genres
      averageScore
      meanScore
      popularity
      favourites
      trending
      tags { name rank }
      studios(isMain: true) { nodes { name } }
      stats { scoreDistribution { score amount } }
    }
  }
}
`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(vars, attempt = 1) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: vars }),
  })
  if (res.status === 429 && attempt <= 3) {
    // 限流時指數退避 / exponential backoff on rate limit
    await sleep(1500 * attempt)
    return fetchPage(vars, attempt + 1)
  }
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300))
  return json.data.Page
}

/** 批次抓取設定 / batch plan */
const BATCHES = [
  { label: 'all-time popularity', pages: 12, sort: ['POPULARITY_DESC'], from: 19600101, to: 20261231 },
  { label: 'recent popularity', pages: 2, sort: ['POPULARITY_DESC'], from: 20230101, to: 20261231 },
  { label: 'trending', pages: 2, sort: ['TRENDING_DESC'], from: 20240101, to: 20261231 },
  { label: 'Chinese donghua', pages: 2, sort: ['POPULARITY_DESC'], country: 'CN', from: 20150101, to: 20261231 },
  { label: 'Korean animation', pages: 1, sort: ['POPULARITY_DESC'], country: 'KR', from: 20100101, to: 20261231 },
]

const REGION = { JP: 'JP', CN: 'CN', KR: 'KR', TW: 'TW' }

function normalize(m) {
  const tags = (m.tags || [])
    .filter((t) => t.rank >= 60)
    .slice(0, 6)
    .map((t) => ({ name: t.name, rank: t.rank }))
  const dist = (m.stats?.scoreDistribution || []).map((s) => ({ score: s.score, amount: s.amount }))
  return {
    id: `anilist-${m.id}`,
    anilistId: m.id,
    medium: 'anime',
    title: {
      zh: m.title.native || m.title.romaji || m.title.english,
      en: m.title.english || m.title.romaji || m.title.native,
      native: m.title.native,
      romaji: m.title.romaji,
    },
    year: m.seasonYear ?? null,
    country: REGION[m.countryOfOrigin] ?? 'JP',
    format: m.format,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    status: m.status,
    genres: m.genres ?? [],
    tags,
    studio: m.studios?.nodes?.[0]?.name ?? null,
    metrics: {
      popularity: m.popularity ?? 0,
      favourites: m.favourites ?? 0,
      meanScore: m.meanScore ?? null,
      averageScore: m.averageScore ?? null,
      trending: m.trending ?? 0,
      ratingCount: dist.reduce((s, x) => s + x.amount, 0),
      scoreDistribution: dist,
    },
    provenance: {
      status: 'measured',
      sources: [
        {
          name: 'AniList GraphQL API',
          url: 'https://anilist.co',
          fetchedAt: SNAPSHOT,
          note: 'popularity / favourites / meanScore / trending 皆為 AniList 快照值',
        },
      ],
    },
  }
}

async function main() {
  const seen = new Map()
  for (const batch of BATCHES) {
    for (let page = 1; page <= batch.pages; page++) {
      const data = await fetchPage({
        page,
        perPage: 50,
        sort: batch.sort,
        from: batch.from,
        to: batch.to,
        country: batch.country,
      })
      for (const m of data.media) {
        if (seen.has(m.id)) continue
        const w = normalize(m)
        // 至少要有一些評分樣本，避免收錄無人評分的冷門作 / require some rating volume
        if (w.metrics.ratingCount < 200 && w.metrics.popularity < 8000) continue
        seen.set(m.id, w)
      }
      process.stdout.write(`  ${batch.label} p${page}: total ${seen.size}\n`)
      await sleep(DELAY_MS)
    }
  }

  const items = [...seen.values()].sort((a, b) => b.metrics.popularity - a.metrics.popularity)
  const out = {
    dataset: 'anime',
    source: 'AniList GraphQL API (https://anilist.co)',
    snapshotDate: SNAPSHOT,
    license: 'AniList 社群資料，非商業原型使用；上線前需替換或取得授權 / community data, non-commercial prototype',
    count: items.length,
    items,
  }
  await fs.writeFile(new URL('../app/src/data/anime.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
  const byCountry = items.reduce((m, x) => ((m[x.country] = (m[x.country] ?? 0) + 1), m), {})
  console.log(`✅ wrote ${items.length} anime (${SNAPSHOT})`, byCountry)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
