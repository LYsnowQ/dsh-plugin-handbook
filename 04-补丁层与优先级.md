# 04 · 补丁层与优先级

## 1. 组合

profile 根配置为空列表，树由 patch 逐层叠加：

```text
bundle 层     每个 bundle 的 cordis.patch.yml（按 dsh.profile.bundles 顺序）
profile 层    $DSH_HOME\profiles\<profile>\cordis.patch.yml
home 层       $DSH_HOME\cordis.patch.yml
覆盖层        --patch <file>（可重复）
```

后应用的层覆盖先应用的层。同一行 id 被多层命中时，最后出现该字段的层生效。
`config` 为整块替换，不是深合并。

profile 的 `cordis.yml` 由 DSH 启动时维护，不得编辑或依赖。

## 2. 层序

| 顺序 | 层 | 路径 | 范围 | 写入方 |
|---|---|---|---|---|
| 1 | bundle | `<bundle>\cordis.patch.yml` | 该 profile | 插件作者 |
| 2 | profile | `$DSH_HOME\profiles\<profile>\cordis.patch.yml` | 仅该 profile | 手工 / 宿主自带插件管理 |
| 3 | home | `$DSH_HOME\cordis.patch.yml` | 所有 profile | 自建管理器（托管区块）+ 手工（区块外） |
| 4 | 覆盖 | `--patch <path>` | 本次启动 | 临时调试 |
| 5 | 遥测 | 环境变量合成，非文件 | 本次启动 | `DSH_TELEMETRY_DISABLED` |

文档中的 100/200/300/400/500 仅表示上述相对顺序，不是 DSH 配置字段。

home 层优先于 profile 层：管理器写 home 层，从而覆盖 profile 层的同类设置。

## 3. 分配规则

| 需求 | 层 | 权重 |
|---|---|---|
| 只读查询/展示，不写配置 | 独立插件，不写 patch | — |
| 修改单条插件配置，仅当前 profile | profile 层 | 200 |
| 跨 profile 启停/配置 | home 层，自有托管区块 | 300 |
| 临时覆盖 | `--patch` | 400 |
| 同一行由两个管理器管理 | 禁止 | — |

新增管理器准入条件：

1. 只写自有托管区块，区块外不修改；
2. 只操作自有命名空间的行 id；禁用官方/内核行与宿主关键行（`05` §5）；
3. 写入原子（临时文件 + rename）；
4. 不通过抢占同一文件中的顺序提升优先级；需要更高权威时使用更晚的层；
5. 写入前校验目标行存在，未知 id 拒绝写入。

## 4. 语法

顶层必须为 YAML 数组。

插入：

```yaml
- insert:
    - id: my-notes
      name: 'my-notes'
      config: {}
```

- 带 `insert` 的项追加行；
- `id` 指向 `group: true` 的行时，插入该 group 的 `config` 列表；
- 相对路径 `name` 以 patch 文件所在目录为基准。

覆盖：

```yaml
- id: my-notes
  name: 'my-notes'
  disabled: true
```

- 仅给 `id`（无 `insert`）表示命中已有行；
- 提供的字段替换原字段；`config` 整块替换；
- `name` 为断言，truthy 时必须与已有行模块名一致；
- 无行命中，或非 insert 项缺少非空 `id`：警告并跳过，不创建新行。

无删除语法。条目只能通过删除引入它的层（`dsh plugin remove`）消失；
否则只能 `disabled: true`。

`disabled` 取值：

```yaml
- id: my-notes
  disabled: true
- id: other
  disabled: null
- id: env-only
  disabled: !!js process.platform !== 'win32'
```

- `!!js` 为 Loader 表达式，不是 `!js`；
- 行元数据中的 `!!js` 按 Loader 上下文求值；`config` 中的 `!!js` 在注入激活后按插件上下文求值；
- `disabled` 为持久组合状态，不是会话开关。

行字段：

| 字段 | 说明 |
|---|---|
| `id` | 本地行 id，组合内唯一 |
| `name` | 模块/包名 |
| `config` | 配置，整块替换 |
| `disabled` | 布尔 / null / `!!js` |
| `inject` | 依赖注入 |
| `intercept` | 拦截 |
| `isolate` | 服务隔离，映射到 `true` 或 realm 标签 |
| `group` | `group: true` + `name: cordis:group` 时 `config` 为嵌套行列表 |
| include 行 | `name: cordis:include` 时从 `config.path` 读取外部行列表 |

## 5. `name` 断言

任一行 `name` 与已有行不符：

```text
patch: name mismatch for "my-notes" (expected "my-notes", got "wrong-name"), skipping
```

整条 patch 被跳过，不仅是该行。表现为该层不出现在 `patched by` 列表，低层状态保持不变。

## 6. 行 id 与包名

- bundle patch 使用本地行 id（`ui-theme-miku`、`tool-notes`）；
- 运行时 Loader 条目 id 为路径限定形式（`include:ui-theme-miku`）。

| 场景 | 使用 |
|---|---|
| 写 patch | 本地 id |
| 读运行时状态 / 管理工具返回 | 路径限定 id |
| 写 `name` | 包名（`@acme/dsh-theme-miku`） |

管理器不得假设 `包名 = 行 id`。必须先解析目标 bundle 的 patch，取得真实行 id 与 `name`。

## 7. 托管区块

```yaml
# >>> my-plugin-manager:managed >>>
# my-plugin-manager: managed entries
- id: my-notes
  name: 'my-notes'
  disabled: false
- id: other-plugin
  disabled: true
# <<< my-plugin-manager:managed <<<
```

规则：

1. 区块由 `# >>> <标识>:managed >>>` 与 `# <<< <标识>:managed <<<` 定位；标识变更需迁移旧区块；
2. 只写区块内；区块外的手写条目、注释、其他工具区块原样保留；
3. 每个登记条目写显式 `disabled: true/false`，不用省略表示启用；
4. 条目按行 id 排序，字段顺序 `id` → `name` → `disabled`；
5. 原子写：完整生成新内容 → 临时文件 → rename；
6. 启用写 `disabled: false`，不能通过删除条目实现。

## 8. 开放边界

- home 层区块外内容由用户或其他工具维护，管理器不得改动；
- `--patch` 可覆盖管理器决定，用于临时验证；
- profile 层手写内容优先于 bundle 层，但低于 home 层；
- `disabled` 为持久状态；仅对当前 profile 生效的禁用写 profile 层。

## 9. 反模式

| 反模式 | 后果 |
|---|---|
| 两个管理器管理同一行 id | 相互覆盖，结果取决于最后写入 |
| 手工编辑托管区块 | 下次重写时丢失 |
| 在 profile 层写 `disabled: false` 覆盖 home 层禁用 | 不生效 |
| 用 `remove` 启停 | 依赖与 bundle 条目被摘除 |
| patch 引用不存在的 id | 启动警告，区块脏 |
| 覆盖 `config` 时只写部分字段 | 其余字段被清空 |
| 禁用 `loader` / `include` / `hmr` 等关键行 | 组合机制失效 |
