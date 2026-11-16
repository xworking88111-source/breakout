/**
 * 站台設定 / Site configuration
 * 廣告版位預留：預設關閉。要啟用時填入 provider 與 client。
 * Ad slot reservation: disabled by default. Fill in provider/client to enable.
 */
export const AD_SLOT = {
  enabled: false,
  provider: '' as '' | 'adsense' | 'ethicalads',
  client: '',
} as const
