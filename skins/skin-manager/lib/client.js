/**
 * dsh-skin-manager —— 浏览器半边
 *
 * 手写的 lazy-CJS 工厂 bundle（官方格式，见 ../../PLUGINS.md §6.3）：
 * 宿主把本文件当**经典脚本**加载，执行时只注册一个工厂，真正的副作用在 factory 里跑。
 *
 * 它只做一件事：在「设置」里加一节「皮肤」，列出全部皮肤做**单选**；
 * 选中后 POST 回宿主（宿主写 home 层托管区块），然后**重载页面**。
 *
 * 为什么不在这里自己注入皮肤 CSS（重要，别再改回去）：
 *   皮肤的观感有**两条腿**——① 一段以 `body[data-dsh-*]` 为作用域的 CSS；② 皮肤插件自己用 JS
 *   插入的装饰节点（例如固定定位的角色立绘/舞台）。只注入 CSS 等于只拿到一条腿：
 *     - 旧皮肤被停用后，它的装饰节点没有对应的 CSS 作用域（body 属性已换），
 *       于是 `position:fixed` 失效、退化成文档流内容，**堆在页面顶部**（用户实测就是这个现象）；
 *     - 新皮肤自己的装饰节点也不会出现 → 只有按钮/对话框这类纯 CSS 部分变样。
 *   页面重载则让 DSH 按新的启用集合重新加载：旧插件不加载（装饰自然不存在）、
 *   新插件加载（装饰 + CSS 一起上），这才是唯一正确的路径。
 */

window.__ModuleLoader__.load({
  id: 'dsh-skin-manager',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')

    /** Cordis 服务名（不是包名）：只用到设置页槽位。 */
    const inject = ['slots']

    const PANEL_STYLE_TAG_ID = 'dsh-skin-manager/panel.css'

    // -----------------------------------------------------------------------
    // 与宿主通信
    // -----------------------------------------------------------------------
    async function fetchManifest() {
      const res = await fetch('/skin-manager/skins.json', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`skins.json ${res.status}`)
      return res.json()
    }

    async function postActive(dir) {
      const res = await fetch('/skin-manager/active.json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir }),
      })
      if (!res.ok) throw new Error(`active.json ${res.status}`)
      return res.json()
    }

    /** 换肤后重载页面：只有全新加载才能让 DSH 按新的启用集合重建皮肤（见文件头注释）。 */
    function reloadPage(delayMs) {
      window.setTimeout(() => {
        try {
          window.location.reload()
        } catch {
          /* 忽略：重载失败也不该把设置面板搞崩 */
        }
      }, delayMs)
    }

    /**
     * 等宿主把 home 层区块写完再重载。
     * 留一点余量是有意的：DSH 的热重载是 chokidar 驱动的（实测 3–6 秒），
     * 重载太早会加载到「还没换完」的组合。最多等 10 秒，超时也照样重载（用户能自己再刷一次）。
     */
    async function waitForApplied(dir, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        try {
          const data = await fetchManifest()
          if ((data.active || '') === dir) return true
        } catch {
          /* 服务还没就绪，继续等 */
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400))
      }
      return false
    }

    // -----------------------------------------------------------------------
    // 设置页里的一节
    // -----------------------------------------------------------------------
    const CSS = [
      '.dshSkinManager{display:flex;flex-direction:column;gap:10px;padding:4px 0}',
      '.dshSkinManager .hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.dshSkinManager .list{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0}',
      '.dshSkinManager .card{display:flex;align-items:center;gap:10px;width:100%;text-align:left;cursor:pointer;',
      'padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);font:inherit}',
      '.dshSkinManager .card:hover{border-color:var(--dsw-alias-border-l2)}',
      '.dshSkinManager .card[data-active="true"]{border-color:var(--skin-accent,var(--dsw-alias-brand-primary));',
      'box-shadow:inset 0 0 0 1px var(--skin-accent,var(--dsw-alias-brand-primary))}',
      '.dshSkinManager .card[data-pending="true"]{opacity:.55}',
      '.dshSkinManager .dot{width:14px;height:14px;border-radius:50%;flex:0 0 auto;border:.5px solid var(--dsw-alias-border-l3)}',
      '.dshSkinManager .main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}',
      '.dshSkinManager .name{font-size:13px;font-weight:600}',
      '.dshSkinManager .meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}',
      '.dshSkinManager .flag{flex:0 0 auto;font-size:12px;color:var(--skin-accent,var(--dsw-alias-brand-primary))}',
    ].join('')

    function installStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(PANEL_STYLE_TAG_ID)}]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-skin-manager'
      tag.dataset.pluginCss = PANEL_STYLE_TAG_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function SkinsSection() {
      const [state, setState] = react.useState({ status: 'loading', active: '', skins: [], error: '' })
      const [busy, setBusy] = react.useState('')
      const [note, setNote] = react.useState('')

      react.useEffect(() => {
        let alive = true
        fetchManifest()
          .then((data) => {
            if (!alive) return
            setState({ status: 'ready', active: data.active || '', skins: data.skins || [], error: '' })
          })
          .catch((error) => {
            if (alive) setState({ status: 'error', active: '', skins: [], error: String(error && error.message) })
          })
        return () => {
          alive = false
        }
      }, [])

      const choose = react.useCallback(async (skin) => {
        const dir = skin ? skin.dir : ''
        if (dir === state.active || busy !== '') return
        setBusy(dir === '' ? '__none__' : dir)
        setNote('正在应用皮肤…')
        try {
          await postActive(dir)
          setState((prev) => Object.assign({}, prev, { active: dir }))
          setNote('已写入配置，等待 DSH 组合更新后自动刷新…')
          await waitForApplied(dir)
          setNote('正在刷新页面应用新皮肤…')
          reloadPage(200)
        } catch (error) {
          setNote(`切换失败：${String(error && error.message)}`)
          setBusy('')
        }
      }, [state.active, busy])

      const rows = [
        react.createElement(
          'button',
          {
            key: '__none__',
            type: 'button',
            className: 'card',
            'data-active': state.active === '' ? 'true' : 'false',
            'data-pending': busy === '__none__' ? 'true' : 'false',
            disabled: busy !== '',
            onClick: () => choose(null),
          },
          react.createElement('span', { className: 'dot' }),
          react.createElement(
            'span',
            { className: 'main' },
            react.createElement('span', { className: 'name' }, '不使用皮肤（DSH 原生外观）'),
          ),
          state.active === '' ? react.createElement('span', { className: 'flag' }, '✓') : null,
        ),
      ]

      for (const skin of state.skins) {
        const isActive = state.active === skin.dir
        rows.push(
          react.createElement(
            'button',
            {
              key: skin.dir,
              type: 'button',
              className: 'card',
              'data-active': isActive ? 'true' : 'false',
              'data-pending': busy === skin.dir ? 'true' : 'false',
              style: skin.accent ? { '--skin-accent': skin.accent } : undefined,
              disabled: busy !== '',
              onClick: () => choose(skin),
            },
            react.createElement('span', {
              className: 'dot',
              style: { background: skin.accent || 'transparent' },
            }),
            react.createElement(
              'span',
              { className: 'main' },
              react.createElement('span', { className: 'name' }, skin.name || skin.dir),
              react.createElement(
                'span',
                { className: 'meta' },
                [skin.author ? `作者 ${skin.author}` : skin.dir, `${skin.cssKB} KB`, skin.version ? `v${skin.version}` : '']
                  .filter(Boolean)
                  .join(' · '),
              ),
            ),
            isActive ? react.createElement('span', { className: 'flag' }, '✓ 使用中') : null,
          ),
        )
      }

      return react.createElement(
        'div',
        { className: 'dshSkinManager' },
        react.createElement(
          'div',
          { className: 'hint' },
          '从下载的皮肤里单选一套。切换会写进 home 层 cordis.patch.yml 的托管区块，然后**自动刷新页面**——' +
            '皮肤由插件自己渲染（背景 + 装饰），刷新是唯一能保证完整换肤的方式。',
        ),
        state.status === 'loading' ? react.createElement('div', { className: 'hint' }, '正在读取皮肤清单…') : null,
        state.status === 'error' ? react.createElement('div', { className: 'hint' }, `读取失败：${state.error}`) : null,
        react.createElement('ul', { className: 'list' }, rows),
        note ? react.createElement('div', { className: 'hint' }, note) : null,
      )
    }

    // -----------------------------------------------------------------------
    // 注册
    // -----------------------------------------------------------------------
    function apply(ctx) {
      installStyles()
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'skins',
            order: 20,
            label: () => '皮肤',
          },
          SkinsSection,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
