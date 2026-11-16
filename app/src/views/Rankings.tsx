import { useMemo } from 'react'
import type { Dataset, Lang, Medium, Work } from '../types'
import type { TKey } from '../i18n'
import { WorkCard } from '../components/WorkCard'
import { buildCsv } from '../lib/recommend'
import { mediumColor, mediumName, scoreColor, titleOf } from '../lib/format'
import { genreLabel, regionLabel } from '../lib/labels'

export type SortKey = 'score' | 'reach' | 'quality' | 'buzz' | 'momentum' | 'year'
export type Filters = {
  medium?: Medium
  region?: string
  genre?: string
  sort: SortKey
  q?: string
  view: 'table' | 'cards'
}
const MEDIA: Medium[] = ['shortdrama', 'anime', 'novel', 'film']

export function Rankings({
  data,
  works,
  lang,
  t,
  filters,
  onChange,
  onOpen,
}: {
  data: Dataset
  works: Work[]
  lang: Lang
  t: (k: TKey) => string
  filters: Filters
  onChange: (f: Filters) => void
  onOpen: (id: string) => void
}) {
  const regions = useMemo(() => [...new Set(works.map((w) => w.region))], [works])
  const genres = useMemo(() => {
    const s = new Set<string>()
    works.forEach((w) => w.genres.forEach((g) => s.add(g)))
    return [...s].sort()
  }, [works])

  const filtered = useMemo(() => {
    let list = [...works]
    if (filters.medium) list = list.filter((w) => w.medium === filters.medium)
    if (filters.region) list = list.filter((w) => w.region === filters.region)
    if (filters.genre) list = list.filter((w) => w.genres.includes(filters.genre!))
    if (filters.q) {
      const q = filters.q.toLowerCase()
      list = list.filter((w) =>
        [w.title.zh, w.title.en, w.title.native ?? '', ...w.tags.map((x) => x.zh + x.en), ...w.genres]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    const key = filters.sort
    list.sort((a, b) => (key === 'year' ? b.year - a.year : key === 'score' ? b.hitScore - a.hitScore : b.dims[key] - a.dims[key]))
    return list
  }, [works, filters])

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const hasFilter = !!(filters.medium || filters.region || filters.genre || filters.q)

  const exportCsv = () => {
    const blob = new Blob([buildCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `breakout-${filters.medium ?? 'all'}-${data.snapshotDate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const sortOptions: { key: SortKey; label: TKey }[] = [
    { key: 'score', label: 'charts.sort.score' },
    { key: 'reach', label: 'charts.sort.reach' },
    { key: 'quality', label: 'charts.sort.quality' },
    { key: 'buzz', label: 'charts.sort.buzz' },
    { key: 'momentum', label: 'charts.sort.momentum' },
    { key: 'year', label: 'charts.sort.year' },
  ]

  return (
    <div className="charts">
      <header className="page-head">
        <div>
          <h1>{t('charts.title')}</h1>
          <p>{t('charts.sub')}</p>
        </div>
        <div className="page-head-side">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
            ↓ {t('charts.export')}
          </button>
          <div className="seg">
            <button className={filters.view === 'table' ? 'on' : ''} onClick={() => set({ view: 'table' })}>
              {t('charts.view.table')}
            </button>
            <button className={filters.view === 'cards' ? 'on' : ''} onClick={() => set({ view: 'cards' })}>
              {t('charts.view.cards')}
            </button>
          </div>
        </div>
      </header>

      <div className="charts-layout">
        <aside className="filters">
          <div className="filter-block">
            <span className="filter-label">{t('charts.filter')}</span>
            <div className="filter-chips">
              <button className={`chipbtn ${!filters.medium ? 'on' : ''}`} onClick={() => set({ medium: undefined })}>
                {t('charts.all')}
              </button>
              {MEDIA.map((m) => (
                <button
                  key={m}
                  className={`chipbtn ${filters.medium === m ? 'on' : ''}`}
                  onClick={() => set({ medium: filters.medium === m ? undefined : m })}
                  style={filters.medium === m ? { borderColor: mediumColor(m), color: mediumColor(m) } : undefined}
                >
                  {mediumName(m, lang)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-label">{t('charts.region')}</span>
            <div className="filter-chips">
              <button className={`chipbtn ${!filters.region ? 'on' : ''}`} onClick={() => set({ region: undefined })}>
                {t('charts.all')}
              </button>
              {regions.map((r) => (
                <button key={r} className={`chipbtn ${filters.region === r ? 'on' : ''}`} onClick={() => set({ region: filters.region === r ? undefined : r })}>
                  {regionLabel(r, lang)}
                </button>
              ))}
            </div>
          </div>

          <label className="filter-block">
            <span className="filter-label">{t('charts.genre')}</span>
            <select value={filters.genre ?? ''} onChange={(e) => set({ genre: e.target.value || undefined })}>
              <option value="">{t('charts.all')}</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {genreLabel(g, lang)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-block">
            <span className="filter-label">{t('charts.sort')}</span>
            <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
              {sortOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          </label>

          {hasFilter && (
            <button className="filter-reset" onClick={() => onChange({ sort: 'score', view: filters.view })}>
              {t('charts.reset')}
            </button>
          )}
        </aside>

        <main className="charts-main">
          <div className="charts-count">
            {t('charts.results').replace('{n}', String(filtered.length))}
            {filters.q && <span className="q-tag">“{filters.q}”</span>}
          </div>

          {filtered.length === 0 && <p className="empty">{t('charts.empty')}</p>}

          {filters.view === 'cards' ? (
            <div className="work-grid">
              {filtered.map((w) => (
                <WorkCard key={w.id} work={w} lang={lang} t={t} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <div className="big-table">
              <div className="bt-head">
                <span>#</span>
                <span>{t('charts.table.work')}</span>
                <span>{t('charts.table.medium')}</span>
                <span>{t('charts.table.year')}</span>
                <span>{t('charts.table.score')}</span>
                <span>{t('charts.table.reach')}</span>
                <span>{t('charts.table.quality')}</span>
                <span>{t('charts.table.confidence')}</span>
                <span>{t('charts.table.status')}</span>
              </div>
              {filtered.map((w, i) => (
                <button key={w.id} className="bt-row" onClick={() => onOpen(w.id)}>
                  <span className="bt-rank">{i + 1}</span>
                  <span className="bt-title">
                    <span>{titleOf(w, lang)}</span>
                    <em>
                      {w.tags.slice(0, 2).map((x) => x.zh).join(' · ')}
                      {w.year ? ` · ${w.year}` : ''}
                    </em>
                  </span>
                  <span style={{ color: mediumColor(w.medium) }}>{mediumName(w.medium, lang)}</span>
                  <span className="bt-dim">{w.year || '—'}</span>
                  <span className="bt-score" style={{ color: scoreColor(w.hitScore) }}>
                    {w.hitScore.toFixed(1)}
                    <i style={{ width: `${w.hitScore}%`, background: scoreColor(w.hitScore) }} />
                  </span>
                  <span className="bt-dim">{Math.round(w.dims.reach)}</span>
                  <span className="bt-dim">{Math.round(w.dims.quality)}</span>
                  <span className={`rt-conf conf-${w.confidence}`}>{t(`confidence.${w.confidence}` as TKey)}</span>
                  <span className={`badge badge-${w.provenance.status}`}>{t(`status.${w.provenance.status}` as TKey)}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
