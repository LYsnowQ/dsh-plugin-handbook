/**
 * dsh-plugin-manager —— 浏览器半边
 *
 * 手写 lazy-CJS 工厂 bundle（官方格式）。
 * 在「设置」里加一节「我的插件」：只列**我自己下载的第三方插件**，每项一个**独立开关**。
 *
 * 与皮肤管理器的区别：皮肤是单选（radio），插件是各自的开关（switch）。
 * 开关只写 home 层 patch 的托管区块，由 DSH 的热重载生效——**服务不重启**。
 * 注意：已打开的页面不会自动收到配置变更通知，彻底生效需要刷新页面。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-manager',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')

    const inject = ['slots']
    const STYLE_TAG_ID = 'dsh-plugin-manager/panel.css'

    async function fetchList() {
      const res = await fetch('/plugin-manager/list.json', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`list.json ${res.status}`)
      return res.json()
    }

    async function postToggle(id, enabled) {
      const res = await fetch('/plugin-manager/toggle.json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      })
      if (!res.ok) throw new Error(`toggle.json ${res.status}`)
      return res.json()
    }

    const CSS = [
      '.dshPluginManager{display:flex;flex-direction:column;gap:10px;padding:4px 0}',
      '.dshPluginManager .hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.dshPluginManager .list{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0}',
      '.dshPluginManager .row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);',
      'border-radius:12px;background:var(--dsw-alias-bg-layer-2)}',
      '.dshPluginManager .row[data-off="true"]{opacity:.6}',
      '.dshPluginManager .main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}',
      '.dshPluginManager .name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dshPluginManager .meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshPluginManager .sw{flex:0 0 auto;width:38px;height:22px;border-radius:11px;border:.5px solid var(--dsw-alias-border-l3);',
      'background:var(--dsw-alias-bg-layer-3);position:relative;cursor:pointer;transition:background .15s}',
      '.dshPluginManager .sw[aria-checked="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent}',
      '.dshPluginManager .sw i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}',
      '.dshPluginManager .sw[aria-checked="true"] i{left:18px}',
      '.dshPluginManager .tag{font-size:11px;padding:1px 6px;border-radius:6px;border:.5px solid var(--dsw-alias-border-l3);',
      'color:var(--dsw-alias-label-tertiary)}',
    ].join('')

    function installStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-plugin-manager'
      tag.dataset.pluginCss = STYLE_TAG_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function MyPluginsSection() {
      const [state, setState] = react.useState({ status: 'loading', plugins: [], error: '' })
      const [busy, setBusy] = react.useState('')
      const [note, setNote] = react.useState('')

      const load = react.useCallback(async () => {
        try {
          const data = await fetchList()
          setState({ status: 'ready', plugins: data.plugins || [], error: '' })
        } catch (error) {
          setState({ status: 'error', plugins: [], error: String(error && error.message) })
        }
      }, [])

      react.useEffect(() => {
        load()
      }, [load])

      const toggle = react.useCallback(
        async (plugin, enabled) => {
          setBusy(plugin.name)
          setNote('')
          try {
            const data = await postToggle(plugin.name, enabled)
            setState({ status: 'ready', plugins: data.plugins || [], error: '' })
            setNote(`${plugin.name} 已${enabled ? '启用' : '停用'}。刷新页面（F5）后彻底生效。`)
          } catch (error) {
            setNote(`操作失败：${String(error && error.message)}`)
          } finally {
            setBusy('')
          }
        },
        [],
      )

      const rows = state.plugins.map((plugin) =>
        react.createElement(
          'li',
          { key: plugin.name, className: 'row', 'data-off': plugin.enabled ? 'false' : 'true' },
          react.createElement(
            'span',
            { className: 'main' },
            react.createElement(
              'span',
              { className: 'name' },
              plugin.name,
              plugin.version ? react.createElement('span', { className: 'tag', style: { marginLeft: 6 } }, `v${plugin.version}`) : null,
              plugin.client ? react.createElement('span', { className: 'tag', style: { marginLeft: 6 } }, '含界面') : null,
              plugin.installed ? null : react.createElement('span', { className: 'tag', style: { marginLeft: 6 } }, '未安装'),
            ),
            react.createElement('span', { className: 'meta' }, plugin.description || '（无描述）'),
          ),
          react.createElement(
            'button',
            {
              type: 'button',
              className: 'sw',
              role: 'switch',
              'aria-checked': plugin.enabled ? 'true' : 'false',
              'aria-label': `${plugin.name} ${plugin.enabled ? '已启用' : '已停用'}`,
              disabled: busy !== '' || !plugin.installed,
              onClick: () => toggle(plugin, !plugin.enabled),
            },
            react.createElement('i'),
          ),
        ),
      )

      return react.createElement(
        'div',
        { className: 'dshPluginManager' },
        react.createElement(
          'div',
          { className: 'hint' },
          '这里只管**我自己下载的第三方插件**（官方 / 内核自带的插件不在此列）。开关写进 home 层 cordis.patch.yml 的托管区块，由 DSH 热重载生效，无需重启服务。',
        ),
        state.status === 'loading' ? react.createElement('div', { className: 'hint' }, '正在扫描已安装的第三方插件…') : null,
        state.status === 'error' ? react.createElement('div', { className: 'hint' }, `读取失败：${state.error}`) : null,
        state.status === 'ready' && state.plugins.length === 0
          ? react.createElement('div', { className: 'hint' }, '还没发现第三方插件（用 dsh plugin --profile <profile> add <包> 装一个就会出现在这里）。')
          : null,
        react.createElement('ul', { className: 'list' }, rows),
        note ? react.createElement('div', { className: 'hint' }, note) : null,
        react.createElement(
          'button',
          {
            type: 'button',
            className: 'reset',
            style: { alignSelf: 'flex-start', background: 0, border: 0, padding: 0, cursor: 'pointer', color: 'var(--dsw-alias-label-link)', font: 'inherit', fontSize: 12 },
            onClick: load,
          },
          '重新扫描',
        ),
      )
    }

    function apply(ctx) {
      installStyles()
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'my-plugins',
            order: 21,
            label: () => '我的插件',
          },
          MyPluginsSection,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
