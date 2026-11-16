import type { Lang, Medium, Work, DimKey } from '../types'
import { MEDIUM_COLOR, MEDIUM_LABEL, DIM_LABEL } from './labels'
import type { TKey } from '../i18n'

export const DIM_ORDER: DimKey[] = ['reach', 'quality', 'buzz', 'momentum', 'crossover']

export function fmtNum(n: number, lang: Lang): string {
  if (!Number.isFinite(n)) return '—'
  if (lang === 'zh') {
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + ' 億'
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + ' 萬'
    return n.toLocaleString('zh-TW')
  }
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString('en-US')
}

export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'zh') return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export type BandKey = 'phenomenon' | 'breakout' | 'strong' | 'worth' | 'modest'

export function bandOf(score: number): BandKey {
  if (score >= 88) return 'phenomenon'
  if (score >= 80) return 'breakout'
  if (score >= 70) return 'strong'
  if (score >= 60) return 'worth'
  return 'modest'
}

export const BAND_COLOR: Record<BandKey, string> = {
  phenomenon: '#FF5C3D',
  breakout: '#FF8A5C',
  strong: '#F5B942',
  worth: '#63C7A5',
  modest: '#7C8A9C',
}

export function bandLabelKey(b: BandKey): TKey {
  return `band.${b}` as TKey
}

export function mediumColor(m: Medium): string {
  return MEDIUM_COLOR[m]
}

export function mediumName(m: Medium, lang: Lang): string {
  return MEDIUM_LABEL[m][lang]
}

export function dimName(k: DimKey, lang: Lang): string {
  return DIM_LABEL[k][lang === 'zh' ? 'zh' : 'en']
}

export function titleOf(w: Work, lang: Lang): string {
  return lang === 'zh' ? w.title.zh : w.title.en
}

export function altTitleOf(w: Work, lang: Lang): string | null {
  const other = lang === 'zh' ? w.title.en : w.title.zh
  if (!other) return null
  if (other === titleOf(w, lang)) return null
  return other
}

export function epLabel(w: Work, lang: Lang): string | null {
  if (!w.episodes) return null
  if (w.medium === 'novel') return lang === 'zh' ? `${w.episodes} 章` : `${w.episodes} ch.`
  return lang === 'zh' ? `${w.episodes} 集` : `${w.episodes} eps`
}

export function runtimeLabel(w: Work, lang: Lang): string | null {
  if (!w.episodeMinutes) return null
  if (w.medium === 'film') return lang === 'zh' ? `片長 ${w.episodeMinutes} 分` : `${w.episodeMinutes} min`
  return lang === 'zh' ? `每集 ${w.episodeMinutes} 分` : `${w.episodeMinutes} min/ep`
}

export function scoreColor(score: number): string {
  return BAND_COLOR[bandOf(score)]
}

export function pct(v: number): string {
  return `${Math.round(v)}`
}

export function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function statusLabelKey(status: string): string {
  return `status.${status}`
}
