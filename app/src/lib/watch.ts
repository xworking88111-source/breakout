import type { Lang, Work } from '../types'

/**
 * 產生「去哪裡看」的連結 / Build "where to watch" links.
 *
 * 重要：紅果沒有官方網頁版（hongguo.com 無法解析），因此對紅果／抖音系作品，
 * 我們提供「抖音搜尋」作為最接近的可行路徑——紅果為抖音集團旗下，
 * 多數紅果短劇可在抖音找到切片或正片入口。
 * Hongguo has no public web version (hongguo.com does not resolve). For Hongguo/Douyin
 * titles we therefore offer a Douyin search link as the closest viable path — Hongguo
 * belongs to ByteDance and most titles have clips or entries on Douyin.
 *
 * 所有連結都是「平台搜尋結果」，不是官方深層連結；部分內容需在 App 內觀看。
 * All links are platform search results, not official deep links; some titles are app-only.
 */

export type WatchLink = { label: string; url: string; primary?: boolean }

const enc = (s: string) => encodeURIComponent(s)

export function watchLinks(w: Work, lang: Lang): WatchLink[] {
  const q = w.title.zh || w.title.en
  const platform = (w.platform ?? '') + ' ' + (w.title.en ?? '')
  const zh = lang === 'zh'
  const links: WatchLink[] = []

  const has = (...keys: string[]) => keys.some((k) => platform.includes(k))

  // 抖音／紅果（同系）/ Douyin & Hongguo
  if (has('紅果', '抖音', '聽花島', '掌玩', '番茄', '河馬', '麥芽', '點眾', '山海', '剛剛好')) {
    links.push({
      label: zh ? '抖音搜尋（紅果同系）' : 'Search on Douyin (Hongguo family)',
      url: `https://www.douyin.com/search/${enc(q)}`,
      primary: true,
    })
  }

  if (has('騰訊')) links.push({ label: zh ? '騰訊視頻' : 'Tencent Video', url: `https://v.qq.com/x/search/?q=${enc(q)}` })
  if (has('愛奇藝')) links.push({ label: zh ? '愛奇藝' : 'iQIYI', url: `https://so.iqiyi.com/so/q_${enc(q)}` })
  if (has('優酷')) links.push({ label: zh ? '優酷' : 'Youku', url: `https://so.youku.com/search_video/q_${enc(q)}` })
  if (has('芒果')) links.push({ label: zh ? '芒果TV' : 'Mango TV', url: `https://so.mgtv.com/so?k=${enc(q)}` })
  if (has('快手')) links.push({ label: zh ? '快手搜尋' : 'Kuaishou search', url: `https://www.kuaishou.com/search/video?searchKey=${enc(q)}` })
  if (has('Bilibili', 'B站')) links.push({ label: 'Bilibili', url: `https://search.bilibili.com/all?keyword=${enc(q)}` })
  if (has('ReelShort')) links.push({ label: 'ReelShort', url: `https://www.reelshort.com/search?keyword=${enc(q)}` })
  if (has('DramaBox')) links.push({ label: 'DramaBox', url: `https://www.dramabox.com/search?keyword=${enc(q)}` })

  // 去重 / de-duplicate by URL
  const seen = new Set<string>()
  const unique = links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)))

  if (!unique.length) {
    // 沒有平台資訊時，至少給一個搜尋入口 / fallback search
    unique.push({
      label: zh ? '在抖音搜尋' : 'Search on Douyin',
      url: `https://www.douyin.com/search/${enc(q)}`,
      primary: true,
    })
  }

  // 最多 3 個，主連結排前 / max three, primary first
  return unique.sort((a, b) => Number(!!b.primary) - Number(!!a.primary)).slice(0, 3)
}
