import type { DimKey, Lang, Medium, Work } from '../types'
import { DIM_ORDER } from './format'

export type Mood = 'satisfy' | 'cry' | 'think' | 'relax' | 'date'
export type Duration = '10' | '30' | '120'

const MOOD_DIMS: Record<Mood, Partial<Record<DimKey, number>>> = {
  // 正權重 = 該維度加分 / positive weight = bonus for that dimension
  satisfy: { momentum: 0.55, buzz: 0.3, reach: 0.2, crossover: 0.15 },
  cry: { quality: 0.6, buzz: 0.25, crossover: 0.1 },
  think: { quality: 0.55, crossover: 0.35, buzz: 0.15 },
  relax: { quality: 0.45, reach: 0.2, momentum: 0.1 },
  date: { quality: 0.4, buzz: 0.3, crossover: 0.2 },
}

const MOOD_GENRES: Record<Mood, string[]> = {
  satisfy: ['Action', 'Power Fantasy', 'Counterattack', 'Fantasy', 'Sports', 'Superhero'],
  cry: ['Drama', 'Romance', 'Family', 'Family Drama', 'Tragedy', 'Historical'],
  think: ['Mystery', 'Thriller', 'Suspense', 'Psychological', 'Sci-Fi', 'Crime'],
  relax: ['Comedy', 'Slice of Life', 'Sweet Pet', 'Urban Romance', 'Adventure'],
  date: ['Romance', 'Sweet Pet', 'Urban Romance', 'Youth', 'Comedy'],
}

export function durationMedium(d: Duration): Medium {
  if (d === '10') return 'shortdrama'
  if (d === '30') return 'anime'
  return 'film'
}

export function recommendWorks(works: Work[], mood: Mood, duration: Duration): Work[] {
  const medium = durationMedium(duration)
  const prof = MOOD_DIMS[mood]
  const genres = new Set(MOOD_GENRES[mood])

  return works
    .filter((w) => w.medium === medium)
    .map((w) => {
      let bonus = 0
      for (const k of DIM_ORDER) bonus += ((w.dims[k] - 60) / 40) * (prof[k] ?? 0) * 10
      const genreHits = w.genres.filter((g) => genres.has(g)).length
      bonus += genreHits * 3.2
      return { w, rank: w.hitScore + bonus }
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map((x) => x.w)
}

const norm = (s: string) => s.trim().toLowerCase()

export function similarWorks(works: Work[], target: Work, n = 3): Work[] {
  const targetTags = new Set(target.tags.map((t) => norm(t.zh + t.en)))
  const targetGenres = new Set(target.genres.map(norm))

  return works
    .filter((w) => w.id !== target.id && w.medium === target.medium)
    .map((w) => {
      const tags = new Set(w.tags.map((t) => norm(t.zh + t.en)))
      let inter = 0
      tags.forEach((t) => {
        if (targetTags.has(t)) inter++
      })
      const tagSim = inter / Math.max(1, Math.min(tags.size, targetTags.size))
      const genreSim =
        w.genres.filter((g) => targetGenres.has(norm(g))).length /
        Math.max(1, Math.min(w.genres.length, targetGenres.size))
      const dimDist =
        DIM_ORDER.reduce((s, k) => s + Math.abs(w.dims[k] - target.dims[k]), 0) / (DIM_ORDER.length * 100)
      const score = tagSim * 1.4 + genreSim * 1.1 + (1 - dimDist) * 0.8
      return { w, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.w)
}

export function buildCsv(works: Work[]): string {
  const header = [
    'id',
    'title_zh',
    'title_en',
    'medium',
    'year',
    'region',
    'platform',
    'hit_score',
    'ci_low',
    'ci_high',
    'reach',
    'quality',
    'buzz',
    'momentum',
    'crossover',
    'data_status',
    'confidence',
    'tags',
    'sources',
  ]
  const rows = works.map((w) =>
    [
      w.id,
      w.title.zh,
      w.title.en,
      w.medium,
      w.year,
      w.region,
      w.platform ?? '',
      w.hitScore,
      w.ci[0],
      w.ci[1],
      w.dims.reach,
      w.dims.quality,
      w.dims.buzz,
      w.dims.momentum,
      w.dims.crossover,
      w.provenance.status,
      w.confidence,
      w.tags.map((t) => t.zh).join('|'),
      w.provenance.sources.map((s) => s.url ?? s.name).join('|'),
    ]
      .map((v) => {
        const s = String(v ?? '')
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      })
      .join(','),
  )
  return '\uFEFF' + [header.join(','), ...rows].join('\n')
}

export function citationOf(w: Work, lang: Lang): string {
  const title = lang === 'zh' ? w.title.zh : w.title.en
  if (lang === 'zh') {
    return `Breakout 破圈（2026）。〈${title}〉資料快照 v0.1，破圈指數 ${w.hitScore}（90% 區間 ${w.ci[0]}–${w.ci[1]}）[Data set]。https://breakout.example/zh-TW/work/${w.id}`
  }
  return `Breakout (2026). ${title} — data snapshot v0.1, Breakout Index ${w.hitScore} (90% interval ${w.ci[0]}–${w.ci[1]}) [Data set]. https://breakout.example/en/work/${w.id}`
}
