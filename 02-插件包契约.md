# 02 · 插件包契约

包根 = 含 `package.json` 的版本层。

## 1. bundle 与两个半边

bundle 是声明了 `dsh.bundle.patch` 的 npm 包；patch 把插件行插入组合树，行的 `name` 指向模块。

| | 宿主半边 | 浏览器半边 |
|---|---|---|
| 入口 | `exports["."]`（或 `main`） | `exports["./client"]` |
| 声明 | `dsh.bundle.patch` | 另加 `dsh.client` |
| 运行环境 | 宿主 Node 进程 | 页面 `window.__ModuleLoader__` |
| 构建 | 不需要，直接运行源码 | 必须已编译 |

只声明 `dsh.client` 而无 `lib\client.js` / `exports["./client"]` 会导致加载失败；只有宿主半边的插件没有设置页入口，属正常。

## 2. `package.json`

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 包名 = 浏览器模块 id = patch 的 `name` 断言 = profile 依赖名 |
| `version` | 是 | 与版本目录名一致 |
| `private` | 建议 | 本地包设 `true` |
| `type` | 是 | 宿主半边为 ESM 时设 `"module"` |
| `exports` | 是 | 至少 `"."`；UI 插件加 `"./client"` |
| `main` | 可选 | `exports` 优先 |
| `dsh.bundle.patch` | 是 | patch 文件相对路径 |
| `dsh.client` | UI 插件必填 | `platform: "web"`；可加 `immediately`、`inject`、`external` |
| `files` | 建议 | 打包保留清单；对 `link:` 安装不过滤 |
| `description` | 建议 | 清单显示用 |
| `license` | 建议 | 第三方包保留上游许可 |

`dsh.client`：

| 字段 | 说明 |
|---|---|
| `platform` | 固定 `"web"` |
| `immediately` | 启动即挂载或按需挂载 |
| `inject` | 依赖的其他客户端插件 id |
| `external` | 需从模块表额外读取的 id；非基线依赖必须在此声明或编译期内联 |

## 3. 宿主插件

```json
{
  "name": "my-notes",
  "version": "1.2.0",
  "private": true,
  "type": "module",
  "description": "本地笔记读写",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" }
  },
  "files": ["lib", "cordis.patch.yml", "README.md", "FILES.md"]
}
```

```js
export const inject = ['tools']

export function apply(ctx, config) {
  return ctx.effect(() => {
    // 注册工具 / 路由 / 监听
  })
}
```

可默认导出服务类；不得混用两种导出形式。

## 4. 浏览器 UI 插件

```json
{
  "name": "@acme/dsh-notes-panel",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true, "inject": [] }
  },
  "files": ["lib", "locale", "icon.svg", "cordis.patch.yml", "README.md", "FILES.md"]
}
```

```js
export function apply() {}
```

```js
window.__ModuleLoader__.load({
  id: '@acme/dsh-notes-panel',          // 必须等于 package.json 的 name
  factory(require) {
    const React = require('react')
    const h = React.createElement

    function Panel() {
      return h('div', { className: 'notes-panel' }, 'Hello')
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'notes-panel', order: 30, label: () => 'Notes' },
            Panel,
          ),
        )
      },
    }
  },
})
```

浏览器半边约束：

- 经典脚本，不得含顶层 `import` / `export` / JSX；
- 入口 `window.__ModuleLoader__.load({ id, factory })`，`id` = 包名；
- `factory` 返回 `{ inject?, apply }`；副作用在 `apply` 内注册并返回清理函数；
- `require()` 仅限平台基线模块（`react`、`react-dom`、`@deepseek-ai/dsh-client-ui-slots`、
  `@deepseek-ai/dsh-client-ui-primitives` 等，以当前 DSH 为准）；
  其他依赖编译期内联，或写入 `dsh.client.external`；
- 资源内联（data URI）或作为包内文件导出；
- 不得替换应用根、向 `document.body` 追加第二应用、读取其他插件 DOM/样式；
- 可见文案走 Client locale，不硬编码多语言。

## 5. `cordis.patch.yml`

```yaml
# 仅声明本插件自身
- insert:
    - id: my-notes                 # 本地行 id，组合内唯一
      name: 'my-notes'             # 包名（断言）；含 @ 必须加引号
      # config: {}
```

- 顶层必须是 YAML 数组；
- `id` 为行 id，不必等于包名（合集、主题类插件通常带前缀），同组合内唯一；
- `name` 为包名，不是行 id；写错会导致整条 patch 被跳过（`04` §5）；
- `config` 为整块替换语义；
- 向 group 插入时用 `id: <group id>` + `insert: [...]`。

## 6. 显示元信息

管理界面与清单会在未激活插件时读取以下字段：

- `locale/en.json`、`locale/zh.json`：

```json
{ "meta": { "title": "笔记面板", "description": "在设置页管理本地笔记。" } }
```

- `exports["./icon"]` 指向包内图标，支持 SVG/PNG/JPEG/WebP，≤ 256 KiB；
- `package.json` 顶层 `icon` 优先于 `./icon`；
- 缺失时回退到 `name` / `description` 与默认图。

## 7. 名称一致性

| 位置 | 值 |
|---|---|
| `package.json` `name` | `my-notes` |
| `load({ id })` | `my-notes` |
| patch 行 `name` | `'my-notes'` |
| profile 依赖 / `dsh.profile.bundles` | `my-notes` |

行 `id` 为独立概念，可与包名不同，但 patch 与托管区块必须一致。

## 8. 错误对照

| 现象 | 原因 | 处理 |
|---|---|---|
| `declares dsh.client but exports no "./client" bundle` | `dsh.client` 存在但缺 `exports["./client"]` | 补 `exports` 与 `lib/client.js` |
| `loaded without registering` | `load({ id })` ≠ 包名，或 factory 未返回 `apply` | 统一 id；修 factory |
| `import failed` | 宿主入口语法/依赖错误，或文件写入不完整 | 修复入口；原子发布 |
| `Cannot find module 'x'` | 使用了非基线模块且未内联/声明 | 编译期内联或 `dsh.client.external` |
| `patch: name mismatch ... skipping` | patch 的 `name` 与包名不一致 | 改为包名，必要时加引号 |
| 注册成功但组合树无条目 | 缺 `dsh.bundle.patch` 或 patch 路径错误 | 补字段/路径后重装 |
| 插件被当作普通依赖 | `package.json` 不在版本层，或多套一层目录 | 调整目录 |
| 管理界面无条目 | 仅宿主半边，或缺 `dsh.client` | 补齐两半边 |
