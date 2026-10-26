/**
 * dsh-skin-manager —— 宿主半边（Node 侧）
 *
 * 职责（三件，别越界）：
 *   1. 读资源清单 resources/skins.json，把「有哪些皮肤」告诉浏览器半边；
 *   2. 把某套皮肤的 CSS 按需吐给浏览器（图片已在 CSS 里内联成 data URI，无需额外路由）；
 *   3. 用户单选某套皮肤后，把结果写进 **home 层** $DSH_HOME/cordis.patch.yml 的**托管区块**，
 *      由 DSH 自己的 `patchReload: live` 监听器重组配置树（实测 6 秒内生效、无需重启）。
 *
 * 设计约束（详见 docs/zh/05-manager-spec.md）：
 *   - 本插件**不**把皮肤注册进 DSH；皮肤只是资源。
 *   - **不**调用 ctx.loader.update(...)：那只改内存态，且 loader 的写回目标是 cordis.yml
 *     （该文件 DSH 每次启动都会覆盖），既不持久也可能污染文件。
 *   - 写 home 层 patch 时**只维护托管区块**，区块外的用户手写条目原样保留（开放性留口）。
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * 解析 $DSH_HOME。
 *
 * 为什么不 import `@deepseek-ai/dsh-home-paths`：本插件是**第三方 bundle**（profile 之外的 link: 安装），
 * 它 import 的裸包名会按「插件文件所在目录」去解析，而插件目录下没有 `@deepseek-ai/*` 的 node_modules，
 * 所以那个官方工具在这里解析不到。好在它的规则很简单，自己实现等价逻辑即可：
 * 显式 DSH_HOME 环境变量 → 否则 os.homedir()/.dsh。
 */
function resolveDshHome() {
  const explicit = process.env.DSH_HOME
  if (typeof explicit === 'string' && explicit.trim() !== '') return path.resolve(explicit.trim())
  return path.join(os.homedir(), '.dsh')
}

// ---------------------------------------------------------------------------
// 路径与常量
// ---------------------------------------------------------------------------
const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const RESOURCES_DIR = path.join(PACKAGE_ROOT, 'resources')
const MANIFEST_FILE = path.join(RESOURCES_DIR, 'skins.json')
const STATE_FILE = path.join(PACKAGE_ROOT, 'state.json')
const TEMPLATE_FILE = path.join(PACKAGE_ROOT, 'templates', 'home.cordis.patch.yml')

/** 托管区块标记。解析时用 includes 匹配，所以模板里写成 YAML 注释也能被识别。 */
const BLOCK_BEGIN = '# >>> dsh-skin-manager:managed >>>'
const BLOCK_END = '# <<< dsh-skin-manager:managed <<<'
/** 托管区块内的条目标题。管理器只“看见”自己这个前缀的条目，别的一律不碰。 */
const MANAGED_TITLE = '# dsh-skin-manager: managed entries'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}
const CSS_HEADERS = {
  'Content-Type': 'text/css; charset=utf-8',
  'Cache-Control': 'no-store',
}

// ---------------------------------------------------------------------------
// 元数据：皮肤清单 + 启用状态
// ---------------------------------------------------------------------------

/** 读取抽取产物清单；失败则抛出可读错误（DSH 会把 apply 的异常显示在插件状态里）。 */
function readManifest() {
  const raw = fs.readFileSync(MANIFEST_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.skins)) {
    throw new Error(`skin-manager: ${MANIFEST_FILE} 缺少 skins 数组`)
  }
  // 皮肤插件的挂载 id 由我们统一约定为 ui-skin-<目录名>（与上游 cordis.patch.yml 一致）
  for (const skin of parsed.skins) {
    if (typeof skin.skinId !== 'string' || skin.skinId === '') skin.skinId = `ui-skin-${skin.dir}`
    if (typeof skin.bodyVars !== 'object' || skin.bodyVars === null) skin.bodyVars = {}
  }
  return parsed
}

/** 读取本插件自己的启用状态（独立文件，避免和皮肤资源混在一起）。 */
function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    return { active: typeof parsed.active === 'string' ? parsed.active : '' }
  } catch {
    return { active: '' }
  }
}

/** 原子写：先写临时文件再 rename，避免 DSH 的 chokidar 读到半个文件。 */
function writeFileAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, file)
}

function writeState(state) {
  writeFileAtomic(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
}

// ---------------------------------------------------------------------------
// home 层 patch 的托管区块
// ---------------------------------------------------------------------------

/** 极小的 YAML 块解析：只认我们写出去的形状（`- id:` 行 + 其后的缩进键值行）。 */
function parseBlockEntries(blockText) {
  const entries = []
  let current = null
  for (const line of blockText.split(/\r?\n/)) {
    const idMatch = /^\s*-\s+id:\s*(.+?)\s*$/.exec(line)
    if (idMatch) {
      current = { id: idMatch[1].replace(/^['"]|['"]$/g, ''), disabled: false }
      entries.push(current)
      continue
    }
    if (current === null) continue
    const kv = /^\s+([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line)
    if (!kv) continue
    const [, key, value] = kv
    if (key === 'disabled') current.disabled = value === 'true'
    else if (key === 'name') current.name = value.replace(/^['"]|['"]$/g, '')
  }
  return entries
}

function renderBlock(entries) {
  const lines = [
    BLOCK_BEGIN,
    MANAGED_TITLE,
    '# 本区块由 dsh-skin-manager 自动生成/维护，请勿手工编辑（下次切换皮肤会覆盖）。',
    '# 想手工写补丁，请写在区块外——区块外的内容会被完整保留。',
  ]
  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`- id: ${entry.id}`)
    if (entry.name) lines.push(`  name: '${entry.name}'`)
    lines.push(`  disabled: ${entry.disabled ? 'true' : 'false'}`)
  }
  lines.push(BLOCK_END)
  return `${lines.join('\n')}\n`
}

/** 去掉只含注释与空白（以及历史遗留的顶层空数组 `[]`）的占位内容，避免和区块拼成非法 YAML。 */
function stripPlaceholder(text) {
  const body = text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      return trimmed !== '' && !trimmed.startsWith('#') && trimmed !== '[]'
    })
    .join('\n')
    .trim()
  return body
}

/**
 * 写 home 层 patch：区块内换成 entries，区块外原样保留。
 * 文件不存在时用 templates/home.cordis.patch.yml 作为起始骨架。
 */
function writeHomePatch(homePath, entries) {
  const text = fs.existsSync(homePath)
    ? fs.readFileSync(homePath, 'utf8')
    : fs.readFileSync(TEMPLATE_FILE, 'utf8')

  const begin = text.indexOf(BLOCK_BEGIN)
  const end = text.indexOf(BLOCK_END)
  let next
  if (begin >= 0 && end > begin) {
    const head = text.slice(0, begin)
    const tail = text.slice(end + BLOCK_END.length).replace(/^\r?\n/, '')
    next = `${head}${renderBlock(entries)}${tail}`
  } else {
    // 没有区块：保留文件里的注释与用户手写条目，只把「顶层空数组占位」清掉
    const head = text
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim()
        if (trimmed === '') return true
        if (trimmed.startsWith('#')) return true
        return trimmed !== '[]'
      })
      .join('\n')
      .replace(/\s*$/, '')
    next = `${head}\n\n${renderBlock(entries)}`
  }
  writeFileAtomic(homePath, next)
  return next
}

/** 读回 home 层里我们托管的那批条目（用于启动时对齐状态）。 */
function readHomeManagedEntries(homePath) {
  try {
    const text = fs.readFileSync(homePath, 'utf8')
    const begin = text.indexOf(BLOCK_BEGIN)
    const end = text.indexOf(BLOCK_END)
    if (begin < 0 || end < begin) return []
    return parseBlockEntries(text.slice(begin, end))
  } catch {
    return []
  }
}

/**
 * 由「当前选中的皮肤」算出托管条目集合：
 * 命中的那一条 enabled，其余全部 disabled（单选语义）。
 * name 一并写进去作为断言（cordis 的 patch 用 id 匹配；name 写错会让整条补丁被跳过，
 * 反而能在皮肤被换包/改名时提前暴露问题）。
 */
function buildManagedEntries(skins, active, previous) {
  const prevById = new Map(previous.map((entry) => [entry.id, entry]))
  return skins.map((skin) => {
    const id = skin.skinId
    const prev = prevById.get(id)
    return {
      id,
      name: prev && prev.name ? prev.name : skin.package,
      disabled: skin.dir !== active,
    }
  })
}

// ---------------------------------------------------------------------------
// HTTP 工具
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// 插件本体
// ---------------------------------------------------------------------------
export const name = 'dsh-skin-manager'
export const inject = ['webServer', 'connection']

export function apply(ctx) {
  let manifest = readManifest()
  let state = readState()
  let active = state.active
  // home 层补丁：$DSH_HOME/cordis.patch.yml
  const homePath = path.join(resolveDshHome(), 'cordis.patch.yml')

  // 启动对齐：让 home 层区块与 state.json 一致（区块缺失/条目数不符时重建；已一致则不写文件，
  // 免得每次启动都触发一次 chokidar 重组）。state.json 是权威——所以手工去改区块不会持久。
  const previous = readHomeManagedEntries(homePath)
  const desired = buildManagedEntries(manifest.skins, active, previous)
  const aligned =
    previous.length === desired.length &&
    desired.every((entry) => {
      const prev = previous.find((item) => item.id === entry.id)
      return prev !== undefined && prev.disabled === entry.disabled
    })
  if (!aligned) writeHomePatch(homePath, desired)

  // ---- 浏览器信任栅栏：所有自定义路由都必须先过这一关（照抄官方/小鲸鱼的做法）----
  function rejected(req, res) {
    try {
      const conn = ctx.get('connection')
      if (!conn || typeof conn.requestRejection !== 'function') return false // fail-open，并在下面留痕
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route.handler
    return ctx.webServer.register(
      Object.assign({}, route, {
        handler: async (req, res) => {
          if (rejected(req, res)) return
          return inner(req, res)
        },
      }),
    )
  }

  function payload() {
    return {
      ok: true,
      active,
      skins: manifest.skins.map((skin) => ({
        dir: skin.dir,
        skinId: skin.skinId,
        name: skin.name,
        nameEn: skin.nameEn,
        author: skin.author,
        accent: skin.accent,
        tagline: skin.tagline,
        bodyAttr: skin.bodyAttr,
        bodyVars: skin.bodyVars,
        cssKB: skin.cssKB,
        previewVersion: skin.version,
      })),
    }
  }

  // ---- 路由 1：清单（含当前选中）----
  registerRoute({
    kind: 'exact',
    path: '/skin-manager/skins.json',
    handler: (req, res) => {
      res.writeHead(200, JSON_HEADERS)
      res.end(JSON.stringify(payload()))
    },
  })

  // ---- 路由 2：某套皮肤的 CSS（资源按需吐，浏览器半边自己注入 <style>）----
  registerRoute({
    kind: 'exact',
    path: '/skin-manager/skin.css',
    handler: (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const dir = url.searchParams.get('dir') ?? ''
      const skin = manifest.skins.find((item) => item.dir === dir)
      if (!skin || typeof skin.cssFile !== 'string') {
        res.writeHead(404, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: `unknown skin: ${dir}` }))
        return
      }
      try {
        const css = fs.readFileSync(path.join(RESOURCES_DIR, skin.cssFile))
        res.writeHead(200, Object.assign({ 'Content-Length': String(css.length) }, CSS_HEADERS))
        res.end(css)
      } catch (error) {
        res.writeHead(500, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String(error && error.message) }))
      }
    },
  })

  // ---- 路由 3：切换皮肤（单选）----
  registerRoute({
    kind: 'exact',
    path: '/skin-manager/active.json',
    handler: async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'PUT') {
        res.writeHead(405, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: 'use POST' }))
        return
      }
      try {
        const parsed = JSON.parse(await readBody(req))
        const dir = typeof parsed.dir === 'string' ? parsed.dir : ''
        if (dir !== '' && !manifest.skins.some((skin) => skin.dir === dir)) {
          res.writeHead(400, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, error: `unknown skin: ${dir}` }))
          return
        }
        active = dir
        state = { active }
        writeState(state)
        const entries = buildManagedEntries(manifest.skins, active, readHomeManagedEntries(homePath))
        writeHomePatch(homePath, entries)
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify(payload()))
      } catch (error) {
        res.writeHead(500, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String(error && error.message) }))
      }
    },
  })

  // ---- 资源清单热更新：改了 skins.json 不必重启（前端下次拉清单就是新的）----
  ctx.effect(() => {
    const timer = setInterval(() => {
      try {
        manifest = readManifest()
      } catch {
        /* 保留上一次可用的清单 */
      }
    }, 5000)
    return () => clearInterval(timer)
  }, 'skin-manager: manifest refresh')
}

export default { name, inject, apply }
