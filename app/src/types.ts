export type Lang = 'zh' | 'en'
export type Medium = 'shortdrama' | 'anime' | 'novel' | 'film'
export type DataStatus = 'measured' | 'estimated' | 'illustrative'

export type DimKey = 'reach' | 'quality' | 'buzz' | 'momentum' | 'crossover'

export interface DimScores {
  reach: number
  quality: number
  buzz: number
  momentum: number
  crossover: number
}

export interface Bilingual {
  zh: string
  en: string
}

export interface Tag extends Bilingual {}

export interface SourceRef {
  name: string
  url?: string
  note?: string
  fetchedAt?: string
}

export interface Provenance {
  status: DataStatus
  sources: SourceRef[]
  note?: Bilingual
}

export interface Evidence {
  text: Bilingual
  source?: SourceRef
}

export interface Work {
  id: string
  medium: Medium
  title: { zh: string; en: string; native?: string }
  year: number
  region: string
  platform?: string
  genres: string[]
  tags: Tag[]
  episodes?: number | null
  episodeMinutes?: number | null
  synopsis: Bilingual
  dims: DimScores
  hitScore: number
  ci: [number, number]
  confidence: 'high' | 'medium' | 'low'
  /** 模型分解：每一維對分數的邊際貢獻（相對 50 基準），總和 = hitScore - 50
   *  Model decomposition: marginal contribution of each dimension vs. the 50 baseline; sum = hitScore - 50 */
  contributions: { key: DimKey; points: number }[]
  /** 質性驅動因素（編輯註記，非模型輸出）
   *  Qualitative drivers (editorial notes, not model output) */
  drivers: Evidence[]
  /** 時序熱度（示範資料，正規化 0-100）
   *  Time-series heat (illustrative data, normalized 0-100) */
  heatCurve?: number[]
  /** 評分分布（實測資料，AniList）
   *  Rating distribution (measured data from AniList) */
  scoreDistribution?: { score: number; amount: number }[]
  anilistId?: number
  provenance: Provenance
}

export interface Dataset {
  dataset: string
  version: string
  snapshotDate: string
  modelVersion: string
  weights: Record<Medium, DimScores>
  dims: Record<DimKey, { zh: string; en: string; descZh: string; descEn: string }>
  works: Work[]
}
