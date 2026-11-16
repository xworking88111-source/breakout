/**
 * Browser half of the Interface tuner: a left-sidebar entry that opens a
 * settings page in the main column. The page adjusts reading comfort without
 * patching the shell: font sizes go through `ctx.theme.setFontSize`, palette
 * presets are token override layers on `ctx.theme.overrideTokens`, and the
 * right panel is collapsed through the layout action face plus the panel's own
 * collapse command. Nothing here reads another plugin's DOM or stylesheet.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-ui-tuner',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-ui-tuner'
    /** Sidebar entry id; it also addresses the main-panel cell. */
    const PANEL_ID = 'ui-tuner'
    /** Override-layer identity, so one palette replaces the previous layer. */
    const LAYER_SOURCE = '@local/dsh-ui-tuner'
    /** Browser-remembered palette id. */
    const PRESET_KEY = 'dsh.ui-tuner.palette'

    /** Font roles this page edits, with the accepted integer ranges. */
    const ROLES = [
      { role: 'text', min: 10, max: 22, reset: 14 },
      { role: 'code', min: 10, max: 16, reset: 11 },
      { role: 'terminal', min: 10, max: 20, reset: 13 },
    ]

    /**
     * Palette presets as alias-token override layers. Every layer also covers
     * the surfaces that read as a bright white in the default light palette —
     * the composer field, code blocks, and the module fill — because recoloring
     * only the page background leaves a mismatched white card in view.
     */
    const PRESETS = {
      default: {
        chip: 'conic-gradient(from 90deg, #f7f7f7 0 50%, #1c1c22 50% 100%)',
        tokens: null,
      },
      soft: {
        chip: 'conic-gradient(from 90deg, #f4f3ef 0 50%, #14151a 50% 100%)',
        tokens: {
          '--dsw-alias-bg-base': { light: '#F4F3EF', dark: '#14151A' },
          '--dsw-alias-bg-layer-1': { light: '#FBFAF7', dark: '#1B1C22' },
          '--dsw-alias-bg-layer-2': { light: '#EFEDE8', dark: '#22232B' },
          '--dsw-alias-bg-overlay': { light: '#FFFFFF', dark: '#23252E' },
          '--dsw-alias-bg-module-platform': { light: '#EFEDE8', dark: '#24252D' },
          '--dsw-alias-border-l1': { light: '#E2DFD7', dark: '#2A2C35' },
          '--dsw-alias-border-l2': { light: '#D3CFC4', dark: '#383B46' },
          '--dsw-alias-border-l3': { light: 'rgba(30,29,26,0.10)', dark: 'rgba(255,255,255,0.12)' },
          '--dsw-alias-label-primary': { light: '#1E1D1A', dark: '#E9E9EC' },
          '--dsw-alias-label-secondary': { light: '#5A574F', dark: '#A2A4AD' },
          '--dsw-alias-label-tertiary': { light: '#6E6A61', dark: '#8A8D96' },
          '--dsw-alias-interactive-bg-hover': { light: 'rgba(30,29,26,0.06)', dark: 'rgba(255,255,255,0.08)' },
          '--dsw-alias-markdown-code-block': { light: '#F0EEE9', dark: '#191A20' },
          '--dsw-alias-markdown-code-block-banner': { light: '#E9E6DF', dark: '#20212A' },
          '--dsw-alias-markdown-inline-code': { light: '#EDEAE4', dark: '#26272F' },
          '--dsw-specific-sidebar-fill': { light: '#EDEBE5', dark: '#17181D' },
          '--dsw-specific-input-major': { light: '#FBFAF7', dark: '#1B1C22' },
          '--dsw-specific-selector': { light: '#EFEDE8', dark: '#26272F' },
          '--dsw-alias-markdown-code-segment-selected': { light: '#FBFAF7', dark: '#2A2B34' },
          '--dsw-alias-markdown-code-segment-unselected': { light: '#E8E5DE', dark: '#1D1E25' },
        },
      },
      warm: {
        chip: 'conic-gradient(from 90deg, #faf5ec 0 50%, #1a1611 50% 100%)',
        tokens: {
          '--dsw-alias-bg-base': { light: '#FAF5EC', dark: '#1A1611' },
          '--dsw-alias-bg-layer-1': { light: '#FFFCF5', dark: '#221C15' },
          '--dsw-alias-bg-layer-2': { light: '#F4ECDF', dark: '#2B241B' },
          '--dsw-alias-bg-overlay': { light: '#FFFDF8', dark: '#2E261C' },
          '--dsw-alias-bg-module-platform': { light: '#F4ECDF', dark: '#2C241B' },
          '--dsw-alias-border-l1': { light: '#EADFCB', dark: '#342B1F' },
          '--dsw-alias-border-l2': { light: '#DCCEB4', dark: '#463A28' },
          '--dsw-alias-border-l3': { light: 'rgba(44,36,24,0.12)', dark: 'rgba(255,255,255,0.12)' },
          '--dsw-alias-label-primary': { light: '#2C2418', dark: '#F0E7D8' },
          '--dsw-alias-label-secondary': { light: '#6B5D48', dark: '#B7A78F' },
          '--dsw-alias-label-tertiary': { light: '#7D6C52', dark: '#9C8D75' },
          '--dsw-alias-interactive-bg-hover': { light: 'rgba(44,36,24,0.06)', dark: 'rgba(255,255,255,0.08)' },
          '--dsw-alias-markdown-code-block': { light: '#F5EDE0', dark: '#1F1A14' },
          '--dsw-alias-markdown-code-block-banner': { light: '#EEE3D2', dark: '#262019' },
          '--dsw-alias-markdown-inline-code': { light: '#F2E9DA', dark: '#2B2419' },
          '--dsw-specific-sidebar-fill': { light: '#F3EBDD', dark: '#1D1811' },
          '--dsw-specific-input-major': { light: '#FFFCF5', dark: '#221C15' },
          '--dsw-specific-selector': { light: '#F4ECDF', dark: '#2C241B' },
          '--dsw-alias-markdown-code-segment-selected': { light: '#FFFCF5', dark: '#33291E' },
          '--dsw-alias-markdown-code-segment-unselected': { light: '#EDE3D3', dark: '#241D15' },
        },
      },
      contrast: {
        chip: 'conic-gradient(from 90deg, #ffffff 0 50%, #000000 50% 100%)',
        tokens: {
          '--dsw-alias-bg-base': { light: '#FFFFFF', dark: '#000000' },
          '--dsw-alias-bg-layer-1': { light: '#FFFFFF', dark: '#0C0C0C' },
          '--dsw-alias-bg-layer-2': { light: '#F2F2F2', dark: '#171717' },
          '--dsw-alias-bg-overlay': { light: '#FFFFFF', dark: '#101010' },
          '--dsw-alias-bg-module-platform': { light: '#F2F2F2', dark: '#1A1A1A' },
          '--dsw-alias-border-l1': { light: '#9A9A9A', dark: '#6E6E6E' },
          '--dsw-alias-border-l2': { light: '#6E6E6E', dark: '#9A9A9A' },
          '--dsw-alias-border-l3': { light: 'rgba(0,0,0,0.45)', dark: 'rgba(255,255,255,0.45)' },
          '--dsw-alias-label-primary': { light: '#000000', dark: '#FFFFFF' },
          '--dsw-alias-label-secondary': { light: '#333333', dark: '#DDDDDD' },
          '--dsw-alias-label-tertiary': { light: '#444444', dark: '#CCCCCC' },
          '--dsw-alias-interactive-bg-hover': { light: 'rgba(0,0,0,0.10)', dark: 'rgba(255,255,255,0.14)' },
          '--dsw-alias-markdown-code-block': { light: '#F2F2F2', dark: '#101010' },
          '--dsw-alias-markdown-code-block-banner': { light: '#E6E6E6', dark: '#1A1A1A' },
          '--dsw-alias-markdown-inline-code': { light: '#F2F2F2', dark: '#1A1A1A' },
          '--dsw-specific-sidebar-fill': { light: '#F7F7F7', dark: '#050505' },
          '--dsw-specific-input-major': { light: '#FFFFFF', dark: '#0C0C0C' },
          '--dsw-specific-selector': { light: '#F2F2F2', dark: '#1A1A1A' },
          '--dsw-alias-markdown-code-segment-selected': { light: '#FFFFFF', dark: '#1F1F1F' },
          '--dsw-alias-markdown-code-segment-unselected': { light: '#E6E6E6', dark: '#141414' },
        },
      },
    }

    /** Preset order in the page. */
    const PRESET_IDS = ['default', 'soft', 'warm', 'contrast']

    /** Traditional Chinese copy (the user's UI language). */
    const zh = {
      'panel': '介面調整',
      'title': '介面調整',
      'subtitle': '調整字級、色調與右側面板。變更會立即套用，不需要重新載入。',
      'back': '回到對話',
      'reset': '重設字級與色調',
      'layout.section': '版面',
      'right.title': '右側面板',
      'right.desc': '工作區文件、終端機與瀏覽器所在的右欄。按下會收合並回到對話；要再打開，用對話標題列右側的展開鈕。',
      'right.collapse': '收合並回到對話',
      'type.section': '字級',
      'type.hint': '字級會寫回介面設定，重新開啟仍然保留。',
      'size.text.title': '內容文字',
      'size.text.desc': '只影響對話內容的字級，介面本身的尺寸不變。',
      'size.code.title': '程式碼',
      'size.code.desc': '程式碼區塊的等寬字；行內程式碼會比它大 1px。',
      'size.terminal.title': '終端機',
      'size.terminal.desc': '側欄終端機的等寬字。',
      'size.decrease': '減小{label}字級',
      'size.increase': '增大{label}字級',
      'unit': 'px',
      'preview.label': '預覽',
      'preview.text': '這段文字會跟著內容字級一起變化，用來確認實際閱讀的舒適度。',
      'color.section': '色調',
      'color.hint': '只覆蓋底色、邊框、文字與輸入框的顏色，不改動明暗主題；覺得刺眼時先試「柔白」。',
      'preset.default': '預設',
      'preset.soft': '柔白',
      'preset.warm': '暖砂',
      'preset.contrast': '高對比',
      'status.applied': '已套用「{name}」',
      'status.reset': '已重設字級與色調',
      'note': '色調記在目前瀏覽器；字級寫回介面設定；右側面板的收合狀態跟著目前工作階段。',
    }

    /** English copy, the key-set peer of the Chinese dictionary. */
    const en = {
      'panel': 'Interface tuner',
      'title': 'Interface tuner',
      'subtitle': 'Adjust text size, palette, and the right panel. Changes apply immediately, no reload needed.',
      'back': 'Back to conversation',
      'reset': 'Reset sizes and palette',
      'layout.section': 'Layout',
      'right.title': 'Right panel',
      'right.desc': 'The column that holds workspace files, the terminal, and the browser. Collapsing it returns you to the conversation; the expand button at the right of the conversation title reopens it.',
      'right.collapse': 'Collapse and return',
      'type.section': 'Text size',
      'type.hint': 'Sizes are written to the interface settings and survive a reload.',
      'size.text.title': 'Content text',
      'size.text.desc': 'Only affects conversation content; the interface keeps its own size.',
      'size.code.title': 'Code',
      'size.code.desc': 'Monospace size inside code blocks; inline code stays 1px larger.',
      'size.terminal.title': 'Terminal',
      'size.terminal.desc': 'Monospace size of the sidebar terminal.',
      'size.decrease': 'Decrease {label} size',
      'size.increase': 'Increase {label} size',
      'unit': 'px',
      'preview.label': 'Preview',
      'preview.text': 'This line follows the content text size, so you can judge the real reading comfort.',
      'color.section': 'Palette',
      'color.hint': 'Overrides surfaces, borders, text, and the composer field only; light and dark stay as chosen. Try Soft when the white is too bright.',
      'preset.default': 'Default',
      'preset.soft': 'Soft',
      'preset.warm': 'Warm',
      'preset.contrast': 'High contrast',
      'status.applied': 'Applied {name}',
      'status.reset': 'Reset sizes and palette',
      'note': 'The palette is remembered in this browser; sizes are written to the interface settings; the collapse state of the right panel follows the current session.',
    }

    /** One override layer and the page's listeners, owned by apply(). */
    const ui = { preset: 'default', layer: null, listeners: new Set() }

    /**
     * Read the remembered palette id.
     * @returns a known preset id, or 'default'.
     */
    function readSavedPreset() {
      try {
        const id = window.localStorage.getItem(PRESET_KEY)
        return id !== null && Object.prototype.hasOwnProperty.call(PRESETS, id) ? id : 'default'
      } catch {
        return 'default'
      }
    }

    /**
     * Remember the palette id for the next page load.
     * @param id - preset id.
     */
    function savePreset(id) {
      try {
        window.localStorage.setItem(PRESET_KEY, id)
      } catch {
        // A browser with storage disabled keeps the palette for this page only.
      }
    }

    /**
     * Replace the plugin's token layer with one preset.
     * @param theme - theme runtime.
     * @param id - preset id.
     * @returns whether the requested layer is now the one in force.
     */
    function applyPalette(theme, id) {
      if (ui.layer !== null) {
        try {
          ui.layer()
        } catch (error) {
          console.error('[ui-tuner] removing the previous palette layer failed', error)
        }
        ui.layer = null
      }
      ui.preset = id
      const preset = PRESETS[id]
      if (preset === undefined || preset.tokens === null) return true
      try {
        ui.layer = theme.overrideTokens(LAYER_SOURCE, preset.tokens)
        return true
      } catch (error) {
        console.error('[ui-tuner] applying the palette layer failed', error)
        ui.preset = 'default'
        return false
      }
    }

    /** Page styles: host type scale, row rhythm, and alias tokens only. */
    const CSS = [
      '.ui-page{box-sizing:border-box;width:100%;height:100%;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:0 clamp(24px,4vw,48px) 48px;color:var(--dsw-alias-label-primary);font-family:inherit}',
      '.ui-page>*{flex:none;width:100%;max-width:960px}',
      '.ui-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:28px 0 20px;border-bottom:.5px solid var(--dsw-alias-border-l3)}',
      '[data-platform="darwin"] .ui-head{padding-top:calc(28px + var(--dsh-frame-top-clearance, 0px))}',
      '.ui-title{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.ui-sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
      '.ui-actions{display:flex;align-items:center;gap:8px;flex:none;padding-top:2px}',
      '.ui-section{padding-top:32px}',
      '.ui-section-title{margin:0 0 4px;font-size:14px;font-weight:600;line-height:22px}',
      '.ui-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.ui-row{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.ui-row:last-child{border-bottom:none}',
      '.ui-row-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding-right:24px}',
      '.ui-row-title{font-size:14px;line-height:22px}',
      '.ui-row-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.ui-control{display:inline-flex;align-items:center;gap:8px;flex:none}',
      '.ui-stepper{display:inline-flex;align-items:center;gap:2px;height:36px;padding:0 4px;border-radius:12px;background:var(--dsw-alias-bg-module-platform)}',
      '.ui-step{appearance:none;width:28px;height:28px;padding:0;border:none;border-radius:8px;background:transparent;color:inherit;font-family:inherit;font-size:16px;line-height:1;cursor:pointer}',
      '.ui-step:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.ui-step:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}',
      '.ui-step:disabled{opacity:.4;cursor:default}',
      '.ui-value{min-width:26px;text-align:center;font-size:14px;font-variant-numeric:tabular-nums}',
      '.ui-unit{font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.ui-preview{margin-top:16px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-module-platform)}',
      '.ui-preview-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.ui-preview-text{margin:6px 0 0;font-size:var(--dsh-content-font-size,14px);line-height:1.6}',
      '.ui-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer}',
      '.ui-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.ui-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}',
      '.ui-btn[data-variant="ghost"]{border-color:transparent;color:var(--dsw-alias-label-secondary)}',
      '.ui-btn[data-variant="ghost"]:hover{color:var(--dsw-alias-label-primary)}',
      '.ui-presets{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px}',
      '.ui-preset{appearance:none;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;cursor:pointer}',
      '.ui-preset:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.ui-preset:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}',
      '.ui-preset[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}',
      '.ui-chip{width:16px;height:16px;flex:none;border-radius:4px;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}',
      '.ui-status{display:block;padding-top:12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-height:18px}',
      '.ui-note{margin:0;padding-top:24px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '@media (max-width:640px){.ui-row{flex-direction:column;align-items:stretch}.ui-row-text{padding-right:0}}',
    ].join('')

    /**
     * Resolve the page's transient status line.
     * @param t - namespace translate.
     * @param status - last action, or null.
     * @returns the localized status text.
     */
    function statusText(t, status) {
      if (status === null) return ''
      if (status.kind === 'reset') return t('status.reset')
      return t('status.applied', { name: t(`preset.${status.id}`) })
    }

    /**
     * One labelled row with a right-aligned control.
     * @param props - title, description, and control element.
     * @returns the row element.
     */
    function Row({ title, desc, control }) {
      return h('div', { className: 'ui-row' },
        h('div', { className: 'ui-row-text' },
          h('div', { className: 'ui-row-title' }, title),
          h('div', { className: 'ui-row-desc' }, desc)),
        h('div', { className: 'ui-control' }, control))
    }

    /**
     * The main-column page: layout, text sizes, and palette.
     * @param props - locale seat plus the injected tuner face.
     * @returns the page element.
     */
    function TunerPage({ t, face }) {
      const [, bump] = React.useReducer((value) => value + 1, 0)
      const [status, setStatus] = React.useState(null)
      React.useEffect(() => face.subscribe(bump), [])

      const sizes = face.sizes()
      const preset = face.presetId()

      return h('div', { className: 'ui-page' },
        h('style', null, CSS),
        h('header', { className: 'ui-head' },
          h('div', null,
            h('h1', { className: 'ui-title' }, t('title')),
            h('p', { className: 'ui-sub' }, t('subtitle'))),
          h('div', { className: 'ui-actions' },
            h('button', {
              type: 'button', className: 'ui-btn', 'data-variant': 'ghost',
              onClick: () => {
                if (face.reset()) setStatus({ kind: 'reset' })
              },
            }, t('reset')),
            h('button', {
              type: 'button', className: 'ui-btn', 'data-variant': 'ghost',
              onClick: () => { face.back() },
            }, t('back')))),
        h('section', { className: 'ui-section' },
          h('h2', { className: 'ui-section-title' }, t('layout.section')),
          h(Row, {
            title: t('right.title'),
            desc: t('right.desc'),
            control: h('button', {
              type: 'button', className: 'ui-btn',
              onClick: () => { face.collapseRight() },
            }, t('right.collapse'))})),
        h('section', { className: 'ui-section' },
          h('h2', { className: 'ui-section-title' }, t('type.section')),
          h('p', { className: 'ui-hint' }, t('type.hint')),
          ROLES.map(({ role, min, max }) => {
            const value = sizes[role]
            const label = t(`size.${role}.title`)
            return h(Row, {
              key: role,
              title: label,
              desc: t(`size.${role}.desc`),
              control: [
                h('div', { className: 'ui-stepper', key: 'stepper' },
                  h('button', {
                    type: 'button', className: 'ui-step', disabled: value <= min,
                    'aria-label': t('size.decrease', { label }),
                    onClick: () => { face.setSize(role, Math.max(min, value - 1)) },
                  }, '\u2212'),
                  h('span', { className: 'ui-value', 'aria-live': 'polite' }, String(value)),
                  h('button', {
                    type: 'button', className: 'ui-step', disabled: value >= max,
                    'aria-label': t('size.increase', { label }),
                    onClick: () => { face.setSize(role, Math.min(max, value + 1)) },
                  }, '+')),
                h('span', { className: 'ui-unit', key: 'unit' }, t('unit')),
              ],
            })
          }),
          h('div', { className: 'ui-preview' },
            h('div', { className: 'ui-preview-label' }, t('preview.label')),
            h('p', { className: 'ui-preview-text' }, t('preview.text')))),
        h('section', { className: 'ui-section' },
          h('h2', { className: 'ui-section-title' }, t('color.section')),
          h('p', { className: 'ui-hint' }, t('color.hint')),
          h('div', { className: 'ui-presets' }, PRESET_IDS.map((id) => h('button', {
            key: id, type: 'button', className: 'ui-preset',
            'aria-pressed': preset === id,
            onClick: () => {
              if (face.setPalette(id)) setStatus({ kind: 'applied', id })
            },
          },
            h('span', { className: 'ui-chip', style: { background: PRESETS[id].chip }, 'aria-hidden': true }),
            h('span', null, t(`preset.${id}`))))),
          h('p', { className: 'ui-status', role: 'status', 'aria-live': 'polite' }, statusText(t, status))),
        h('p', { className: 'ui-note' }, t('note')))
    }

    /**
     * The sidebar entry glyph: two slider tracks.
     * @param props - the sidebar's icon share.
     * @returns the icon element.
     */
    function TunerIcon({ size }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        'aria-hidden': true, focusable: 'false',
      },
        h('path', { d: 'M4 8h6.6' }),
        h('circle', { cx: 13.6, cy: 8, r: 2.2 }),
        h('path', { d: 'M15.8 8H20' }),
        h('path', { d: 'M4 16h8.6' }),
        h('circle', { cx: 15.6, cy: 16, r: 2.2 }),
        h('path', { d: 'M17.8 16H20' }))
    }

    return {
      inject: ['slots', 'layout', 'theme', 'locale'],
      apply(ctx) {
        const layout = ctx.layout
        const theme = ctx.theme
        const t = ctx.locale.bind(NS)

        const notify = () => {
          for (const listener of [...ui.listeners]) {
            try {
              listener()
            } catch (error) {
              console.error('[ui-tuner] listener failed', error)
            }
          }
        }

        /** Ask the right column to collapse once the conversation is on screen again. */
        const settleRightPanel = () => {
          const right = ctx.get('sidebarRight')
          if (right === undefined || typeof right.isExpanded !== 'function') return false
          try {
            if (!right.isExpanded()) return true
            right.toggleExpanded()
            return true
          } catch {
            return false
          }
        }

        const face = {
          sizes: () => theme.getTheme().fontSizes,
          presetId: () => ui.preset,
          setSize(role, px) {
            const spec = ROLES.find(candidate => candidate.role === role)
            if (spec === undefined) return
            const value = Math.min(spec.max, Math.max(spec.min, Math.round(px)))
            if (theme.getTheme().fontSizes[role] === value) return
            try {
              theme.setFontSize(role, value)
            } catch (error) {
              console.error('[ui-tuner] changing a font size failed', error)
            }
          },
          setPalette(id) {
            if (!Object.prototype.hasOwnProperty.call(PRESETS, id)) return false
            const applied = applyPalette(theme, id)
            if (applied) savePreset(id)
            notify()
            return applied
          },
          reset() {
            for (const { role, reset } of ROLES) face.setSize(role, reset)
            const paletteOk = face.setPalette('default')
            const sizesOk = ROLES.every(({ role, reset }) => theme.getTheme().fontSizes[role] === reset)
            return paletteOk && sizesOk
          },
          back() {
            try {
              layout.selectPanel(null)
            } catch (error) {
              console.error('[ui-tuner] returning to the conversation failed', error)
            }
          },
          collapseRight() {
            // No track immediately, so the space is already reclaimed during the
            // navigation. Naming the on-screen Session happens inside selectPanel,
            // so the panel's own collapse command can run in the same gesture and
            // record the state without a frame of the panel sliding back in.
            try {
              layout.closeRightbar()
            } catch (error) {
              console.error('[ui-tuner] hiding the right track failed', error)
            }
            face.back()
            if (!settleRightPanel()) window.setTimeout(() => { settleRightPanel() }, 0)
          },
          subscribe(listener) {
            ui.listeners.add(listener)
            return () => { ui.listeners.delete(listener) }
          },
        }

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tuner: dictionaries')
        ctx.effect(() => ctx.on('theme/change', notify), 'ui-tuner: theme changes')

        applyPalette(theme, readSavedPreset())

        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ face }),
        }, TunerPage)), 'ui-tuner: page')

        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: () => t('panel'),
        }, TunerIcon)), 'ui-tuner: sidebar entry')

        ctx.effect(() => () => {
          ui.listeners.clear()
          if (ui.layer !== null) {
            try {
              ui.layer()
            } catch (error) {
              console.error('[ui-tuner] removing the palette layer failed', error)
            }
            ui.layer = null
          }
          try {
            if (layout.panelInfo.getSnapshot().activePanelId === PANEL_ID) layout.selectPanel(null)
          } catch (error) {
            console.error('[ui-tuner] leaving the page on unload failed', error)
          }
        }, 'ui-tuner: teardown')
      },
    }
  },
})
