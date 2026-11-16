import { useMemo } from 'react'
import type { Dataset, Lang, Medium, Work } from '../types'
import type { TKey } from '../i18n'
import { mediumColor, mediumName, scoreColor, titleOf } from '../lib/format'
import { regionLabel } from '../lib/labels'

export type Board = { medium: Medium; region: string; works: Work[] }

/** 依「媒介 × 地區」建立榜單，至少 5 部才成榜 / build medium × region boards with >= 5 titles */
export function getBoards(works: Work[], min = 5): Board[] {
  const map = new Map<string, Board>()
  for (const w of works) {
    const key = `${w.medium}/${w.region}`
    if (!map.has(key)) map.set(key, { medium: w.medium, region: w.region, works: [] })
    map.get(key)!.works.push(w)
  }
  return [...map.values()]
    .filter((b) => b.works.length >= min)
    .map((b) => ({ ...b, works: [...b.works].sort((x, y) => y.hitScore - x.hitScore) }))
    .sort((a, b) => b.works.length - a.works.length)
}

export function BoardCard({
  board,
  lang,
  t,
  onOpen,
  onView,
}: {
  board: Board
  lang: Lang
  t: (k: TKey) => string
  onOpen: (id: string) => void
  onView?: () => void
}) {
  const color = mediumColor(board.medium)
  return (
    <div className="board-card" style={{ ['--m' as string]: color }}>
      <div className="board-head">
        <span className="mchip" style={{ color, borderColor: color + '55', background: color + '14' }}>
          {mediumName(board.medium, lang)}
        </span>
        <span className="board-region">{regionLabel(board.region, lang)}</span>
        <span className="board-count">{t('boards.count').replace('{n}', String(board.works.length))}</span>
      </div>
      <ol className="board-list">
        {board.works.slice(0, 5).map((w, i) => (
          <li key={w.id}>
            <button onClick={() => onOpen(w.id)}>
              <span className="board-rank">{i + 1}</span>
              <span className="board-title">{titleOf(w, lang)}</span>
              <span className="board-score" style={{ color: scoreColor(w.hitScore) }}>
                {w.hitScore.toFixed(1)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {onView && (
        <button className="board-more" onClick={onView}>
          {t('boards.top')} →
        </button>
      )}
    </div>
  )
}

export function Boards({
  data,
  works,
  lang,
  t,
  onOpen,
  selected,
  onSelect,
}: {
  data: Dataset
  works: Work[]
  lang: Lang
  t: (k: TKey) => string
  onOpen: (id: string) => void
  selected: { medium: Medium; region: string } | null
  onSelect: (s: { medium: Medium; region: string } | null) => void
}) {
  const boards = useMemo(() => getBoards(works, 5), [works])
  const current = useMemo(
    () => (selected ? boards.find((b) => b.medium === selected.medium && b.region === selected.region) : null),
    [boards, selected],
  )

  if (current) {
    const color = mediumColor(current.medium)
    const top = current.works.slice(0, 25)
    return (
      <div className="charts">
        <button className="back" onClick={() => onSelect(null)}>
          ← {t('boards.all')}
        </button>
        <header className="page-head">
          <div>
            <span className="kicker" style={{ color }}>
              {t('boards.top')}
            </span>
            <h1>
              {regionLabel(current.region, lang)} · {mediumName(current.medium, lang)}
            </h1>
            <p>
              {t('boards.sub')} · {t('boards.count').replace('{n}', String(current.works.length))}
            </p>
          </div>
        </header>
        <div className="big-table">
          <div className="bt-head">
            <span>#</span>
            <span>{t('charts.table.work')}</span>
            <span>{t('charts.table.year')}</span>
            <span>{t('charts.table.score')}</span>
            <span>{t('charts.table.confidence')}</span>
            <span>{t('charts.table.status')}</span>
          </div>
          {top.map((w, i) => (
            <button key={w.id} className="bt-row board-row" onClick={() => onOpen(w.id)}>
              <span className="bt-rank">{i + 1}</span>
              <span className="bt-title">
                <span>{titleOf(w, lang)}</span>
                <em>{w.platform ?? w.tags.slice(0, 2).map((x) => x.zh).join(' · ')}</em>
              </span>
              <span className="bt-dim">{w.year || '—'}</span>
              <span className="bt-score" style={{ color: scoreColor(w.hitScore) }}>
                {w.hitScore.toFixed(1)}
                <i style={{ width: `${w.hitScore}%`, background: scoreColor(w.hitScore) }} />
              </span>
              <span className={`rt-conf conf-${w.confidence}`}>{t(`confidence.${w.confidence}` as TKey)}</span>
              <span className={`badge badge-${w.provenance.status}`}>{t(`status.${w.provenance.status}` as TKey)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 分組顯示：先媒介，再地區 / grouped by medium then region
  const media: Medium[] = ['shortdrama', 'anime', 'novel', 'film']
  return (
    <div className="boards">
      <header className="page-head">
        <div>
          <h1>{t('boards.title')}</h1>
          <p>{t('boards.sub')}</p>
        </div>
        <div className="method-meta">
          <div>
            <span>{t('boards.total')}</span>
            <strong>{boards.length}</strong>
          </div>
          <div>
            <span>{t('method.snapshot')}</span>
            <strong>{data.snapshotDate}</strong>
          </div>
        </div>
      </header>
      {media.map((m) => {
        const list = boards.filter((b) => b.medium === m)
        if (!list.length) return null
        return (
          <section className="section" key={m} style={{ marginTop: 34 }}>
            <div className="section-head">
              <div>
                <h2 style={{ color: mediumColor(m) }}>{mediumName(m, lang)}</h2>
                <p>{t('boards.mediumSub')}</p>
              </div>
            </div>
            <div className="board-grid">
              {list.map((b) => (
                <BoardCard
                  key={`${b.medium}-${b.region}`}
                  board={b}
                  lang={lang}
                  t={t}
                  onOpen={onOpen}
                  onView={() => onSelect({ medium: b.medium, region: b.region })}
                />
              ))}
            </div>
          </section>
        )
      })}
      <p className="hint boards-note">{t('boards.minNote')}</p>
      <p className="hint">
        {t('boards.bandNote')} · {t('band.phenomenon')} ≥ 88 · {t('band.breakout')} ≥ 80 · {t('band.strong')} ≥ 70
      </p>
    </div>
  )
}
