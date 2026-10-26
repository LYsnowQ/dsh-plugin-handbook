# 05 · 管理器规范

管理器是管理插件启停的插件：在宿主设置页提供开关/单选，通过写 patch 生效。

## 1. 范围

| 负责 | 不负责 |
|---|---|
| 第三方/自建插件的启停 | 安装/卸载（`dsh plugin`） |
| 合集插件的单选切换 | 插件自身配置（`Config` / settings 命名空间） |
| 设置页管理界面 | 官方/内核行、宿主关键行 |
| 自有托管区块与登记表 | 其他管理器区块、用户手写条目 |

## 2. 形态

```text
<管理器>\
├── package.json            # dsh.bundle.patch + dsh.client
├── cordis.patch.yml        # 仅插入管理器自身
├── lib\
│   ├── index.js            # 宿主半边
│   └── client.js           # 浏览器半边
├── resources\              # 可选
├── README.md
└── FILES.md
```

- 单层结构，无版本目录、无 `current`；
- 两个半边缺一不可：缺 `lib\client.js` / `exports["./client"]` 时设置页无入口；
- 被管资源由管理器目录提供，不要求其成为独立插件；
- 状态以 patch 为准；状态文件仅作默认值或元数据。

宿主半边职责：

- 发现：扫描 profile `node_modules`（或宿主提供的 bundle 清单），筛选声明 `dsh.bundle.patch` 的第三方包；
- 解析：读取 bundle patch，取得真实行 id 与 `name`；
- 读状态：读取 home 层自有托管区块；
- 写状态：重写托管区块；
- 路由：列表、切换、重扫。

浏览器半边：

- `window.__ModuleLoader__.load({ id: '<管理器包名>', factory })`；
- 在 `settings.section` 注入管理界面；
- 调用宿主路由，更新列表；
- 切换后提示刷新页面。

## 3. 标识与区块

```yaml
# >>> my-plugin-manager:managed >>>
# my-plugin-manager: managed entries
- id: my-notes
  name: 'my-notes'
  disabled: false
# <<< my-plugin-manager:managed <<<
```

- 管理器标识使用包名；
- 行 id 按领域加前缀（`ui-theme-*`、`tool-*`、`panel-*`）；同一前缀归属单一管理器；
- 条目按 `id` 排序，字段顺序固定，重复写入结果幂等。

## 4. 状态来源

- patch 是启停状态的唯一事实来源；启动时从托管区块重建 UI 状态；
- 登记表（如 `resources\registry.json`）只表示「哪些插件归本管理器管」，不表示启停；
- 区块缺失或损坏时重建空区块，不推断内容；
- 状态文件不得覆盖 patch 中的实际值。

## 5. 硬性约束

1. **只写自有托管区块**：读整个文件 → 定位标记 → 替换中间段 → 原子写回；区块外不修改。
2. **只操作自有命名空间的行 id**：
   - 拒绝 `@deepseek-ai/*`；
   - 禁止禁用 `loader`、`webserver`、`clientModules`、`include`、`hmr`；
   - 写入前核对当前组合，未知 id 返回错误。
3. **原子写**：home 层有文件监听，半文件会触发失败重载；使用临时文件 + rename。
4. **不抢占优先级**：通过层级获得权威（home 300 > profile 200），不在同一文件中竞争顺序。
5. **不自锁**：不管理自身，不禁用自身依赖的组件，不接管维持管理器可用的行。

## 6. 热重载

- DSH 监听 profile 层与 home 层 patch；修改后事务性重组，HTTP 服务不重启；
- 浏览器不自动收到通知，切换后需刷新页面；
- 不得用 `ctx.loader.update(id, { disabled })` 代替写文件：仅内存态，写回目标 `cordis.yml` 会在下次启动被覆盖；
- 读取运行时状态时，条目 id 为路径限定形式（`include:...`），与 patch 本地 id 不同。

## 7. 失败处理

| 情况 | 处理 |
|---|---|
| 目标 id 不存在 | 拒绝写入，返回 4xx，提示重扫 |
| 目标属于 `@deepseek-ai/*` | 拒绝 |
| 托管区块不存在 | 用含标记的模板重建 |
| patch 文件不存在 | 创建仅含区块的文件；模板路径不得写死为其他插件私有路径 |
| 写入失败 | 保留旧文件，返回错误 |
| 并发写入 | 进程内串行化；写前重读文件 |
| 区块外条目失效 | 不删除、不修改 |

## 8. 与宿主自带插件管理

DSH 自带插件管理（若当前版本提供；侧栏插件页、`plugin_manager` 工具），写入 profile 层 patch 与
`dsh.profile.bundles`；自建管理器写 home 层。home 层晚于 profile 层，因此同一行 id 被自建管理器
写死后，自带界面的开关不会生效。

约束：同一行 id 只能由一个控制面管理。混用时用 `--dump-config` 查看 `patched by` 列表，
最后一个 patch 文件为实际生效层。
