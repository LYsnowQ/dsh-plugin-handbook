/**
 * dsh-plugin-manager —— 宿主半边（Node 侧）
 *
 * 定位：**管我自己下载的第三方插件**（把它们的启停收进 DSH 设置页），
 * 与官方/内核自带的插件明确分开——官方插件本来就多，不该混进来。
 *
 * 与皮肤管理器同一套机制（home 层 patch 托管区块 + DSH 自己的热重载），区别只在：
 *   - 皮肤管理器：单选（radio），同一时间只有一套皮肤生效；
 *   - 插件管理器：每项独立开关（switch），互不影响。
 *
 * 边界：
 *   - **不**动 `@deepseek-ai/*`（内核/官方）与 profile 模板自带的 bundle；
 *   - 只对 resources/registry.json 里 `managed: true` 的插件写托管补丁；
 *   - 写 patch 时只维护自己那个区块，区块外一律保留。
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * 解析 $DSH_HOME（规则同官方 `@deepseek-ai/dsh-home-paths`，但不 import 它——
 * 第三方 bundle 在插件目录下解析不到 `@deepseek-ai/*` 裸导入）：
 * 显式 DSH_HOME → 否则 os.homedir()/.dsh。
 */
function resolveDshHome() {
  const explicit = process.env.DSH_HOME
  if (typeof explicit === 'string' && explicit.trim() !== '') return path.resolve(explicit.trim())
  return path.join(os.homedir(), '.dsh')
}

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REGISTRY_FILE = path.join(PACKAGE_ROOT, 'resources', 'registry.json')
const TEMPLATE_FILE = path.join(PACKAGE_ROOT, 'templates', 'home.cordis.patch.yml')

const BLOCK_BEGIN = '# >>> dsh-plugin-manager:managed >>>'
const BLOCK_END = '# <<< dsh-plugin-manager:managed <<<'
const MANAGED_TITLE = '# dsh-plugin-manager: managed entries'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

// ---------------------------------------------------------------------------
// registry.json：谁归我管
// ---------------------------------------------------------------------------
function readRegistry() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'))
    if (parsed && Array.isArray(parsed.plugins)) return parsed
  } catch {
    /* 落到下面的默认值 */
  }
  return { version: 1, plugins: [], _comment: '由 dsh-plugin-manager 维护' }
}

function writeFileAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, text, 'utf8')
  fs.renameSync(tmp, file)
}

function writeRegistry(registry) {
  writeFileAtomic(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`)
}

// ---------------------------------------------------------------------------
// 发现：profile 里装了哪些第三方 bundle 插件
// ---------------------------------------------------------------------------

/** 官方/内核包的判定：@deepseek-ai/ 作用域，或宿主注入的 dsh-* 内置包。 */
function isOfficial(name) {
  return name.startsWith('@deepseek-ai/') || name === 'dsh' || name.startsWith('@deepseek-ai')
}

/**
 * 皮肤包不归本管理器管——它们统一由 `skins/skin-manager`（单选）负责。
 * 这里只是**不显示**，不影响它们的注册与启停。
 */
function isSkinPackage(name) {
  return /dsh-client-ui-skin-/.test(name)
}

/**
 * 扫 profile 的 node_modules，找出「声明了 dsh.bundle.patch 的第三方包」。
 * 只读 package.json，不 import 任何东西。
 */
function discover(profileDir) {
  const found = new Map()
  const roots = [path.join(profileDir, 'node_modules')]
  for (const root of roots) {
    let entries = []
    try {
      entries = fs.readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const candidates = entry.name.startsWith('@')
        ? (() => {
            try {
              return fs
                .readdirSync(path.join(root, entry.name), { withFileTypes: true })
                .map((child) => ({ dir: path.join(root, entry.name, child.name), name: `${entry.name}/${child.name}` }))
            } catch {
              return []
            }
          })()
        : [{ dir: path.join(root, entry.name), name: entry.name }]
      for (const candidate of candidates) {
        const pkgFile = path.join(candidate.dir, 'package.json')
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
          const patch = pkg?.dsh?.bundle?.patch
          if (typeof patch !== 'string' || patch === '') continue
          if (isOfficial(pkg.name || candidate.name)) continue
          if (isSkinPackage(pkg.name || candidate.name)) continue // 皮肤交给 skin-manager
          found.set(candidate.dir, {
            name: pkg.name || candidate.name,
            version: pkg.version,
            description: pkg.description,
            dir: candidate.dir,
            client: pkg?.dsh?.client?.platform === 'web',
          })
        } catch {
          /* 不是包 / 读不了，跳过 */
        }
      }
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// home 层 patch 托管区块（与皮肤管理器同一套约定，各自独立区块）
// ---------------------------------------------------------------------------
function readManagedEntries(homePath) {
  try {
    const text = fs.readFileSync(homePath, 'utf8')
    const begin = text.indexOf(BLOCK_BEGIN)
    const end = text.indexOf(BLOCK_END)
    if (begin < 0 || end < begin) return []
    const entries = []
    let current = null
    for (const line of text.slice(begin, end).split(/\r?\n/)) {
      const idMatch = /^\s*-\s+id:\s*(.+?)\s*$/.exec(line)
      if (idMatch) {
        current = { id: idMatch[1].replace(/^['"]|['"]$/g, ''), disabled: false }
        entries.push(current)
        continue
      }
      if (current === null) continue
      const kv = /^\s+([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line)
      if (!kv) continue
      if (kv[1] === 'disabled') current.disabled = kv[2] === 'true'
      else if (kv[1] === 'name') current.name = kv[2].replace(/^['"]|['"]$/g, '')
    }
    return entries
  } catch {
    return []
  }
}

function renderBlock(entries) {
  const lines = [
    BLOCK_BEGIN,
    MANAGED_TITLE,
    '# 本区块由 dsh-plugin-manager 自动生成/维护，请勿手工编辑（下次在设置里开关插件会覆盖）。',
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

function writeHomePatch(homePath, entries) {
  let text
  if (fs.existsSync(homePath)) {
    text = fs.readFileSync(homePath, 'utf8')
  } else if (fs.existsSync(TEMPLATE_FILE)) {
    text = fs.readFileSync(TEMPLATE_FILE, 'utf8')
  } else {
    text = `# $DSH_HOME/cordis.patch.yml（由 dsh-plugin-manager 创建）\n`
  }
  const begin = text.indexOf(BLOCK_BEGIN)
  const end = text.indexOf(BLOCK_END)
  let next
  if (begin >= 0 && end > begin) {
    next = text.slice(0, begin) + renderBlock(entries) + text.slice(end + BLOCK_END.length).replace(/^\r?\n/, '')
  } else {
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

// ---------------------------------------------------------------------------
// 插件本体
// ---------------------------------------------------------------------------
export const name = 'dsh-plugin-manager'
export const inject = ['webServer', 'connection', 'loader']

export function apply(ctx) {
  const homePath = path.join(resolveDshHome(), 'cordis.patch.yml')

  // Profile directory: derive it from the root include entry's config path;
  // otherwise fall back to DSH_PROFILE.
  function profileDir() {
    try {
      const include = ctx.loader?.resolve?.('include')
      const cfgPath = include?.subtree?.config?.path ?? include?.options?.config?.path
      if (typeof cfgPath === 'string' && cfgPath !== '') {
        // The loader may report a file:// URL; accept both URL and local path.
        const local = cfgPath.startsWith('file://') ? fileURLToPath(cfgPath) : cfgPath
        return path.dirname(local)
      }
    } catch {
      /* fall back to DSH_PROFILE */
    }
    const fromEnv = typeof process.env.DSH_PROFILE === 'string' ? process.env.DSH_PROFILE.trim() : ''
    if (fromEnv === '') {
      throw new Error('dsh-plugin-manager: cannot resolve profile directory; set DSH_PROFILE')
    }
    return path.join(resolveDshHome(), 'profiles', fromEnv)
  }

  /** 组装给浏览器半边的清单：发现的第三方插件 + registry 里的托管标记与启停状态。 */
  function payload() {
    const registry = readRegistry()
    const installed = discover(profileDir())
    const managedById = new Map(
      (registry.plugins || []).filter((item) => item && typeof item.id === 'string').map((item) => [item.id, item]),
    )
    const disabledIds = new Set(readManagedEntries(homePath).filter((entry) => entry.disabled).map((entry) => entry.id))

    const plugins = []
    for (const info of installed.values()) {
      const managed = managedById.get(info.name)
      plugins.push({
        name: info.name,
        version: info.version,
        description: info.description || '',
        client: info.client,
        managed: managed ? managed.managed !== false : false,
        enabled: !disabledIds.has(info.name),
        installed: true,
      })
    }
    // registry 里有、但当前 profile 没装的条目也报出来（便于排查）
    for (const [id, item] of managedById) {
      if (plugins.some((plugin) => plugin.name === id)) continue
      plugins.push({
        name: id,
        version: item.version,
        description: item.description || '',
        client: false,
        managed: item.managed !== false,
        enabled: !disabledIds.has(id),
        installed: false,
      })
    }
    plugins.sort((a, b) => a.name.localeCompare(b.name))
    return { ok: true, plugins, profile: profileDir(), home: homePath }
  }

  /** 按 registry 里的托管集合重写 home 层区块（单选/多选由调用方决定 disabled 集合）。 */
  function syncPatch(registry, disabledIds) {
    const entries = []
    for (const item of registry.plugins || []) {
      if (!item || typeof item.id !== 'string') continue
      if (item.managed === false) continue
      const previous = readManagedEntries(homePath).find((entry) => entry.id === item.id)
      entries.push({
        id: item.id,
        name: previous && previous.name ? previous.name : undefined,
        disabled: disabledIds.has(item.id),
      })
    }
    writeHomePatch(homePath, entries)
  }

  // ---- 信任栅栏（与皮肤管理器/小鲸鱼完全同款）----
  function rejected(req, res) {
    try {
      const conn = ctx.get('connection')
      if (!conn || typeof conn.requestRejection !== 'function') return false
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

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  // ---- 路由 1：清单 ----
  registerRoute({
    kind: 'exact',
    path: '/plugin-manager/list.json',
    handler: (req, res) => {
      res.writeHead(200, JSON_HEADERS)
      res.end(JSON.stringify(payload()))
    },
  })

  // ---- 路由 2：开关一个插件（独立开关，不是单选）----
  registerRoute({
    kind: 'exact',
    path: '/plugin-manager/toggle.json',
    handler: async (req, res) => {
      if (req.method !== 'POST' && req.method !== 'PUT') {
        res.writeHead(405, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: 'use POST' }))
        return
      }
      try {
        const parsed = JSON.parse(await readBody(req))
        const id = typeof parsed.id === 'string' ? parsed.id : ''
        const enabled = parsed.enabled === true
        if (id === '' || isOfficial(id)) {
          res.writeHead(400, JSON_HEADERS)
          res.end(JSON.stringify({ ok: false, error: `refusing to manage: ${id}` }))
          return
        }
        const registry = readRegistry()
        const existing = (registry.plugins || []).find((item) => item.id === id)
        if (existing) existing.managed = true
        else (registry.plugins ||= []).push({ id, managed: true })
        const disabledIds = new Set(readManagedEntries(homePath).filter((entry) => entry.disabled).map((entry) => entry.id))
        if (enabled) disabledIds.delete(id)
        else disabledIds.add(id)
        writeRegistry(registry)
        syncPatch(registry, disabledIds)
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify(payload()))
      } catch (error) {
        res.writeHead(500, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String(error && error.message) }))
      }
    },
  })

  // ---- 路由 3：重新扫描（新装了插件后刷新列表）----
  registerRoute({
    kind: 'exact',
    path: '/plugin-manager/rescan.json',
    handler: (req, res) => {
      res.writeHead(200, JSON_HEADERS)
      res.end(JSON.stringify(payload()))
    },
  })

  // 启动时把区块补齐：registry 里 managed 的条目若不在区块里，补上（保持 enabled 默认）
  const registry = readRegistry()
  const managed = (registry.plugins || []).filter((item) => item && typeof item.id === 'string' && item.managed !== false)
  if (managed.length > 0) {
    const present = new Set(readManagedEntries(homePath).map((entry) => entry.id))
    if (managed.some((item) => !present.has(item.id))) {
      syncPatch(registry, new Set())
    }
  }
}

export default { name, inject, apply }
