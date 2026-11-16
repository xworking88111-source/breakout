import type { Lang } from '../types'
import type { TKey } from '../i18n'
import { DIM_LABEL } from '../lib/labels'

export type Insights = {
  generatedAt: string
  datasetVersion: string
  n: number
  counts: Record<string, number>
  genreLift: { key: string; n: number; mean: number; lift: number }[]
  tagLift: { key: string; n: number; mean: number; lift: number }[]
  platformLift: { key: string; n: number; mean: number; lift: number }[]
  topVsRest: { n: { top: number; rest: number }; top: Record<string, number>; rest: Record<string, number>; gap: Record<string, number> }
  sameAgeShortdrama: { n: { high: number; low: number }; high: Record<string, number>; low: Record<string, number>; gap: Record<string, number> }
  collectFilm: {
    n: { high: number; low: number }
    collectMedian: { high: number; low: number }
    quality: { high: number; low: number }
    buzz: { high: number; low: number }
    doingShare: { high: number; low: number }
  } | null
  collectNovel: Insights['collectFilm']
  findingsZh: string[]
  findingsEn: string[]
}

const DIMS = ['reach', 'quality', 'buzz', 'momentum', 'crossover'] as const

function ProfileCompare({
  title,
  note,
  high,
  low,
  highLabel,
  lowLabel,
  lang,
}: {
  title: string
  note: string
  high: Record<string, number>
  low: Record<string, number>
  highLabel: string
  lowLabel: string
  lang: Lang
}) {
  return (
    <div className="block">
      <div className="block-head">
        <h2>{title}</h2>
        <span className="hint">{note}</span>
      </div>
      <div className="profile-compare">
        {DIMS.map((d) => (
          <div className="pc-row" key={d}>
            <span className="pc-dim">{DIM_LABEL[d][lang]}</span>
            <div className="pc-bars">
              <div className="pc-bar">
                <i className="pc-fill high" style={{ width: `${high[d]}%` }} />
                <em>{Math.round(high[d])}</em>
              </div>
              <div className="pc-bar">
                <i className="pc-fill low" style={{ width: `${low[d]}%` }} />
                <em>{Math.round(low[d])}</em>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pc-legend">
        <span>
          <i className="dot high" /> {highLabel}
        </span>
        <span>
          <i className="dot low" /> {lowLabel}
        </span>
      </div>
    </div>
  )
}

function LiftList({
  items,
  t,
  limit = 12,
}: {
  items: { key: string; n: number; mean: number; lift: number }[]
  t: (k: TKey) => string
  limit?: number
}) {
  const max = Math.max(...items.map((x) => Math.abs(x.lift)), 1)
  return (
    <div className="lift-list">
      {items.slice(0, limit).map((x) => (
        <div className="lift-row" key={x.key}>
          <span className="lift-key">{x.key}</span>
          <span className="lift-n">n={x.n}</span>
          <div className="lift-track">
            <i className={x.lift >= 0 ? 'pos' : 'neg'} style={{ width: `${(Math.abs(x.lift) / max) * 100}%` }} />
          </div>
          <span className={`lift-val ${x.lift >= 0 ? 'pos' : 'neg'}`}>
            {x.lift >= 0 ? '+' : ''}
            {x.lift}
          </span>
        </div>
      ))}
      <p className="hint">{t('insights.liftNote')}</p>
    </div>
  )
}

export function InsightsPage({ insights, lang, t }: { insights: Insights | null; lang: Lang; t: (k: TKey) => string }) {
  if (!insights) {
    return (
      <div className="method">
        <p className="empty">{t('common.loading')}</p>
      </div>
    )
  }
  const findings = lang === 'zh' ? insights.findingsZh : insights.findingsEn

  return (
    <div className="method insights">
      <header className="page-head">
        <div>
          <h1>{t('insights.title')}</h1>
          <p>{t('insights.sub').replace('{n}', insights.n.toLocaleString())}</p>
        </div>
        <div className="method-meta">
          <div>
            <span>{t('method.snapshot')}</span>
            <strong>{insights.generatedAt}</strong>
          </div>
          <div>
            <span>{t('boards.total')}</span>
            <strong>{insights.n}</strong>
          </div>
        </div>
      </header>

      <section className="block findings">
        <div className="block-head">
          <h2>{t('insights.findings')}</h2>
        </div>
        <ul className="finding-list">
          {findings.map((f, i) => (
            <li key={i}>
              <span className="finding-idx">{String(i + 1).padStart(2, '0')}</span>
              {f}
            </li>
          ))}
        </ul>
      </section>

      <div className="insight-grid">
        <ProfileCompare
          title={t('insights.topVsRest')}
          note={`n=${insights.topVsRest.n.top} vs ${insights.topVsRest.n.rest}`}
          high={insights.topVsRest.top}
          low={insights.topVsRest.rest}
          highLabel={t('insights.top10')}
          lowLabel={t('insights.rest')}
          lang={lang}
        />
        <ProfileCompare
          title={t('insights.sameAge')}
          note={`n=${insights.sameAgeShortdrama.n.high} vs ${insights.sameAgeShortdrama.n.low}`}
          high={insights.sameAgeShortdrama.high}
          low={insights.sameAgeShortdrama.low}
          highLabel={t('insights.q4')}
          lowLabel={t('insights.q1')}
          lang={lang}
        />
      </div>

      <section className="block">
        <div className="block-head">
          <h2>{t('insights.genre')}</h2>
          <span className="hint">{t('insights.genreNote')}</span>
        </div>
        <LiftList items={insights.genreLift} t={t} />
      </section>

      <div className="insight-grid">
        <section className="block">
          <div className="block-head">
            <h2>{t('insights.tag')}</h2>
          </div>
          <LiftList items={insights.tagLift.slice(0, 10)} t={t} limit={10} />
        </section>
        <section className="block">
          <div className="block-head">
            <h2>{t('insights.platform')}</h2>
          </div>
          <LiftList items={insights.platformLift} t={t} limit={10} />
        </section>
      </div>

      {insights.collectFilm && (
        <section className="block">
          <div className="block-head">
            <h2>{t('insights.collect')}</h2>
            <span className="hint">{t('insights.collectNote')}</span>
          </div>
          <p className="prose">{t('insights.collectBody')}</p>
          <div className="collect-grid">
            {(['film', 'novel'] as const).map((m) => {
              const c = m === 'film' ? insights.collectFilm : insights.collectNovel
              if (!c) return null
              return (
                <div className="collect-card" key={m}>
                  <span className="collect-medium">{m === 'film' ? t('medium.film') : t('medium.novel')}</span>
                  <div className="collect-row">
                    <span>{t('insights.collectMedian')}</span>
                    <strong>
                      {c.collectMedian.high.toLocaleString()} vs {c.collectMedian.low.toLocaleString()}
                    </strong>
                  </div>
                  <div className="collect-row">
                    <span>{t('dim.quality')}</span>
                    <strong>
                      {c.quality.high} vs {c.quality.low}
                    </strong>
                  </div>
                  <div className="collect-row">
                    <span>{t('dim.buzz')}</span>
                    <strong>
                      {c.buzz.high} vs {c.buzz.low}
                    </strong>
                  </div>
                  <div className="collect-row">
                    <span>{t('insights.doing')}</span>
                    <strong>
                      {(c.doingShare.high * 100).toFixed(1)}% vs {(c.doingShare.low * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <span className="hint">n={c.n.high} vs {c.n.low}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <h2>{t('insights.caveatTitle')}</h2>
        </div>
        <ul className="limit-list">
          <li>{t('insights.caveat1')}</li>
          <li>{t('insights.caveat2')}</li>
          <li>{t('insights.caveat3')}</li>
          <li>{t('insights.caveat4')}</li>
        </ul>
        <p className="hint">
          {t('insights.fullReport')}{' '}
          <a href="https://github.com/xworking88111-source/breakout/blob/main/docs/09-%E7%88%86%E6%AC%BE%E5%9B%A0%E5%AD%90%E5%88%86%E6%9E%90.md" target="_blank" rel="noreferrer noopener">
            docs/09-爆款因子分析.md ↗
          </a>{' '}
          <a href="https://github.com/xworking88111-source/breakout/blob/main/docs/11-%E7%B4%85%E6%9E%9C%E6%A9%9F%E5%88%B6%E8%88%87%E7%88%86%E6%AC%BE%E6%88%90%E5%9B%A0.md" target="_blank" rel="noreferrer noopener">
            docs/11-紅果機制與爆款成因.md ↗
          </a>
        </p>
      </section>
    </div>
  )
}
