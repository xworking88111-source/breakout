#!/usr/bin/env node
/**
 * 從 AniList 公開 GraphQL API 抓取真實動畫數據，輸出 app/src/data/anime.json
 * Fetch real anime data from the public AniList GraphQL API into app/src/data/anime.json
 *
 * 用法 / Usage: node scripts/fetch_anilist.mjs
 *
 * 資料來源 / Source: https://anilist.co (public GraphQL API, free, no key)
 * 授權注意 / Licence: AniList data is community-contributed. This project uses it for a
 *   non-commercial prototype; verify the terms before production use and consider an
 *   official licence or a self-hosted database. Cover images are intentionally not used
 *   (the UI draws typographic posters instead) to avoid image licensing issues.
 */

const ENDPOINT = 'https://graphql.anilist.co'
const SNAPSHOT_DATE = new Date().toISOString().slice(0, 10)

const QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $from: FuzzyDateInt, $to: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, isAdult: false,
          startDate_greater: $from, startDate_lesser: $to, format_in: [TV, MOVIE, ONA]) {
      id
      title { romaji english native }
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
      rankings { rank type season year allTime }
      stats { scoreDistribution { score amount } }
    }
  }
}
`

async function fetchPage(vars) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: vars }),
  })
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data.Page.media
}

// AniList 已提供 native 標題，不需另外對照表。
// AniList already returns the native title, so no extra mapping is needed.

function pickTitle(t) {
  return {
    zh: t.native || t.romaji || t.english,
    en: t.english || t.romaji || t.native,
    native: t.native,
    romaji: t.romaji,
  }
}

// 把 AniList 的 media 物件轉成站內統一的 work 格式（不含分數，分數由 build_dataset 計算）。
// Map an AniList media object into our internal work shape (scores are added later by build_dataset).
  const tags = (m.tags || [])
    .filter((t) => t.rank >= 60)
    .slice(0, 6)
    .map((t) => ({ name: t.name, rank: t.rank }))

  return {
    id: `anilist-${m.id}`,
    anilistId: m.id,
    medium: 'anime',
    title: pickTitle(m.title),
    year: m.seasonYear ?? null,
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
      rankings: (m.rankings || []).slice(0, 6),
      scoreDistribution: (m.stats?.scoreDistribution || []).map((s) => ({
        score: s.score,
        amount: s.amount,
      })),
    },
    provenance: {
      status: 'measured',
      sources: [
        {
          name: 'AniList GraphQL API',
          url: 'https://anilist.co',
          fetchedAt: SNAPSHOT_DATE,
          note: 'popularity / favourites / meanScore / trending 皆為 AniList 快照值',
        },
      ],
    },
  }
}

async function main() {
  const recent = await fetchPage({
    page: 1,
    perPage: 30,
    sort: ['POPULARITY_DESC'],
    from: 20200101,
    to: 20261231,
  })
  const airing = await fetchPage({
    page: 1,
    perPage: 12,
    sort: ['TRENDING_DESC'],
    from: 20250601,
    to: 20261231,
  })
  const classics = await fetchPage({
    page: 1,
    perPage: 8,
    sort: ['POPULARITY_DESC'],
    from: 19900101,
    to: 20191231,
  })

  const seen = new Set()
  const all = []
  for (const m of [...recent, ...airing, ...classics]) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    all.push(normalize(m))
  }

  all.sort((a, b) => b.metrics.popularity - a.metrics.popularity)

  const out = {
    dataset: 'anime',
    source: 'AniList GraphQL API (https://anilist.co)',
    snapshotDate: SNAPSHOT_DATE,
    license: 'AniList 社群資料，非商業原型使用；上線前需替換或取得授權',
    count: all.length,
    items: all,
  }

  const fs = await import('node:fs/promises')
  const path = new URL('../app/src/data/anime.json', import.meta.url)
  await fs.writeFile(path, JSON.stringify(out, null, 2), 'utf8')
  console.log(`✅ wrote ${all.length} anime → app/src/data/anime.json (${SNAPSHOT_DATE})`)
  console.log('   top5:', all.slice(0, 5).map((x) => `${x.title.native}(${x.metrics.popularity})`).join(', '))
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
