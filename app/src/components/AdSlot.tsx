import { AD_SLOT } from '../config'

/**
 * 廣告版位（預留）/ Reserved ad slot.
 * - 生產環境且未啟用時：完全不渲染（不影響版面與隱私）。
 * - 開發環境：顯示虛線佔位，方便設計師預留空間。
 * - 啟用後：輸出一個帶 data-ad-slot 的容器，由廣告腳本注入。
 *
 * Production with ads disabled: renders nothing.
 * Development: shows a dashed placeholder.
 * Enabled: renders a container with data-ad-slot for the ad script.
 */
export function AdSlot({ placement, lang }: { placement: 'home' | 'detail' | 'charts'; lang: 'zh' | 'en' }) {
  if (!AD_SLOT.enabled) {
    if (!import.meta.env.DEV) return null
    return (
      <div className="ad-slot ad-slot-reserved" aria-hidden>
        <span>{lang === 'zh' ? '廣告版位（預留・未啟用）' : 'Ad slot (reserved, disabled)'}</span>
        <em>{placement}</em>
      </div>
    )
  }
  return <div className="ad-slot" data-ad-slot={placement} data-ad-client={AD_SLOT.client} />
}
