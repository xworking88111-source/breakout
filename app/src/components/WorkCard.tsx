import type { Lang, Work } from '../types'
import type { TKey } from '../i18n'
import { bandLabelKey, bandOf, epLabel, mediumColor, mediumName, scoreColor, titleOf } from '../lib/format'
import { DIM_ORDER } from '../lib/format'
import { dimName } from '../lib/format'

function hashHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export function Poster({ work, size = 'md' }: { work: Work; size?: 'sm' | 'md' | 'lg' }) {
  const color = mediumColor(work.medium)
  const hue = hashHue(work.id)
  const glyph = work.title.zh.trim().slice(0, 1) || '·'
  return (
    <div
      className={`poster poster-${size}`}
      style={{
        background: `linear-gradient(145deg, ${color} 0%, ${color}99 38%, #0a0c10 78%)`,
        ['--hue' as string]: String(hue),
      }}
      aria-hidden
    >
      <span className="poster-grid" />
      <span className="poster-glyph">{glyph}</span>
      <span className="poster-line" />
    </div>
  )
}

export function StatusBadge({
  status,
  confidence,
  t,
}: {
  status: Work['provenance']['status']
  confidence: Work['confidence']
  t: (k: TKey) => string
}) {
  const labels: Record<string, string> = {
    measured: t('status.measured'),
    estimated: t('status.estimated'),
    illustrative: t('status.illustrative'),
  }
  return (
    <span className={`badge badge-${status}`} title={`${labels[status]} · ${t(`confidence.${confidence}` as TKey)}`}>
      <i className="dot" />
      {labels[status]}
    </span>
  )
}

export function DimStrip({ work }: { work: Work }) {
  return (
    <div className="dimstrip">
      {DIM_ORDER.map((k) => (
        <span key={k} className="dimstrip-item" title={`${k}: ${work.dims[k]}`}>
          <i style={{ height: `${Math.max(8, work.dims[k])}%`, background: mediumColor(work.medium) }} />
        </span>
      ))}
    </div>
  )
}

export function WorkCard({
  work,
  lang,
  t,
  onOpen,
  variant = 'grid',
  rank,
}: {
  work: Work
  lang: Lang
  t: (k: TKey) => string
  onOpen: (id: string) => void
  variant?: 'grid' | 'spot' | 'row'
  rank?: number
}) {
  const color = mediumColor(work.medium)
  const band = bandOf(work.hitScore)
  const topDim = [...DIM_ORDER].sort((a, b) => work.dims[b] - work.dims[a])[0]

  if (variant === 'row') {
    return (
      <button className="wrow" onClick={() => onOpen(work.id)} style={{ ['--m' as string]: color }}>
        <span className="wrow-rank">{rank ?? '·'}</span>
        <Poster work={work} size="sm" />
        <span className="wrow-main">
          <span className="wrow-title">{titleOf(work, lang)}</span>
          <span className="wrow-meta">
            {mediumName(work.medium, lang)} · {work.year}
          </span>
        </span>
        <span className="wrow-score" style={{ color: scoreColor(work.hitScore) }}>
          {work.hitScore.toFixed(1)}
        </span>
      </button>
    )
  }

  return (
    <button className={`wcard wcard-${variant}`} onClick={() => onOpen(work.id)} style={{ ['--m' as string]: color }}>
      <div className="wcard-top">
        <Poster work={work} size={variant === 'spot' ? 'lg' : 'md'} />
        <div className="wcard-head">
          <div className="wcard-badges">
            <span className="mchip" style={{ color, borderColor: color + '55', background: color + '14' }}>
              {mediumName(work.medium, lang)}
            </span>
            <StatusBadge status={work.provenance.status} confidence={work.confidence} t={t} />
          </div>
          <div className="wcard-score" style={{ color: scoreColor(work.hitScore) }}>
            {work.hitScore.toFixed(1)}
            <span className="wcard-band">{t(bandLabelKey(band))}</span>
          </div>
        </div>
      </div>
      <div className="wcard-body">
        <h3 className="wcard-title">{titleOf(work, lang)}</h3>
        <p className="wcard-meta">
          {work.year}
          {work.platform ? ` · ${work.platform}` : ''}
          {epLabel(work, lang) ? ` · ${epLabel(work, lang)}` : ''}
        </p>
        <div className="wcard-tags">
          {work.genres.slice(0, 3).map((g) => (
            <span key={g} className="tagline">
              {g}
            </span>
          ))}
        </div>
        <div className="wcard-foot">
          <span className="wcard-why">{t('card.why')}</span>
          <span className="wcard-reason" style={{ color }}>
            {dimName(topDim, lang)} {Math.round(work.dims[topDim])}
          </span>
          <DimStrip work={work} />
        </div>
      </div>
    </button>
  )
}
