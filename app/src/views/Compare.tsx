import type { Lang, Work } from '../types'
import type { TKey } from '../i18n'
import { Radar } from '../components/Charts'
import { mediumColor, mediumName, scoreColor, titleOf, dimName, bandLabelKey, bandOf } from '../lib/format'
import { DIM_ORDER } from '../lib/format'

export function Compare({
  works,
  ids,
  lang,
  t,
  onSelect,
  onOpen,
}: {
  works: Work[]
  ids: string[]
  lang: Lang
  t: (k: TKey) => string
  onSelect: (ids: string[]) => void
  onOpen: (id: string) => void
}) {
  const picked = ids.map((id) => works.find((w) => w.id === id)).filter((w): w is Work => !!w)
  const slots = [0, 1, 2]

  const setAt = (i: number, id: string) => {
    const next = [...ids]
    if (!id) next.splice(i, 1)
    else next[i] = id
    onSelect([...new Set(next.filter(Boolean))].slice(0, 3))
  }

  return (
    <div className="compare">
      <header className="page-head">
        <div>
          <h1>{t('compare.title')}</h1>
          <p>{t('compare.sub')}</p>
        </div>
        {picked.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => onSelect([])}>
            {t('compare.clear')}
          </button>
        )}
      </header>

      <div className="compare-slots">
        {slots.map((i) => {
          const w = picked[i]
          return (
            <div key={i} className={`cslot ${w ? 'filled' : ''}`} style={w ? { ['--m' as string]: mediumColor(w.medium) } : undefined}>
              {w ? (
                <>
                  <div className="cslot-head">
                    <span className="mchip" style={{ color: mediumColor(w.medium), borderColor: mediumColor(w.medium) + '55' }}>
                      {mediumName(w.medium, lang)}
                    </span>
                    <button className="iconbtn" onClick={() => setAt(i, '')} aria-label={t('compare.remove')}>
                      ✕
                    </button>
                  </div>
                  <button className="cslot-title" onClick={() => onOpen(w.id)}>
                    {titleOf(w, lang)}
                  </button>
                  <span className="cslot-score" style={{ color: scoreColor(w.hitScore) }}>
                    {w.hitScore.toFixed(1)}
                  </span>
                  <span className="cslot-band" style={{ color: scoreColor(w.hitScore) }}>
                    {t(bandLabelKey(bandOf(w.hitScore)))}
                  </span>
                </>
              ) : (
                <label className="cslot-empty">
                  <span>＋ {t('compare.add')}</span>
                  <select value="" onChange={(e) => setAt(i, e.target.value)}>
                    <option value="">{t('compare.pick')}</option>
                    {works.map((x) => (
                      <option key={x.id} value={x.id}>
                        {titleOf(x, lang)} — {mediumName(x.medium, lang)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )
        })}
      </div>

      {picked.length < 2 ? (
        <p className="empty">{t('compare.empty')}</p>
      ) : (
        <>
          <div className="compare-radar">
            <div className="block-head">
              <h2>{t('compare.radar')}</h2>
              <span className="hint">{t('compare.note')}</span>
            </div>
            <Radar
              series={picked.map((w) => ({ values: DIM_ORDER.map((k) => w.dims[k]), color: mediumColor(w.medium), label: titleOf(w, lang) }))}
              labels={DIM_ORDER.map((k) => dimName(k, lang))}
              size={360}
              lang={lang}
            />
            <div className="radar-legend">
              {picked.map((w) => (
                <span key={w.id}>
                  <i style={{ background: mediumColor(w.medium) }} /> {titleOf(w, lang)}
                </span>
              ))}
            </div>
          </div>

          <div className="ctable">
            <div className="ct-head">
              <span>{t('compare.dim')}</span>
              {picked.map((w) => (
                <span key={w.id}>{titleOf(w, lang)}</span>
              ))}
            </div>
            <div className="ct-row ct-row-score">
              <span>{t('work.score')}</span>
              {picked.map((w) => (
                <span key={w.id} className="ct-val" style={{ color: scoreColor(w.hitScore) }}>
                  {w.hitScore.toFixed(1)}
                </span>
              ))}
            </div>
            {DIM_ORDER.map((k) => {
              const max = Math.max(...picked.map((w) => w.dims[k]))
              return (
                <div className="ct-row" key={k}>
                  <span>{dimName(k, lang)}</span>
                  {picked.map((w) => (
                    <span key={w.id} className={`ct-val ${w.dims[k] === max ? 'best' : ''}`}>
                      {Math.round(w.dims[k])}
                      <i style={{ width: `${w.dims[k]}%`, background: mediumColor(w.medium) }} />
                    </span>
                  ))}
                </div>
              )
            })}
            <div className="ct-row">
              <span>{t('work.ci')}</span>
              {picked.map((w) => (
                <span key={w.id} className="ct-val ct-ci">
                  {w.ci[0]}–{w.ci[1]}
                </span>
              ))}
            </div>
            <div className="ct-row">
              <span>{t('charts.table.status')}</span>
              {picked.map((w) => (
                <span key={w.id} className={`badge badge-${w.provenance.status}`}>
                  {t(`status.${w.provenance.status}` as TKey)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
