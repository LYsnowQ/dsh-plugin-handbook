# 07 · 检查清单与排错

## 1. 新增插件

- [ ] 确定形态：独立插件 / 合集 / 管理层（`01` §1）
- [ ] 建目录 `%PLUGIN_ROOT%\<包名>\<版本>\`
- [ ] `package.json` 位于版本层，含 `name`、`version`、`type`、`exports`、`dsh.bundle.patch`；
      UI 插件另含 `dsh.client` 与 `exports["./client"]`
- [ ] `cordis.patch.yml` 仅插入本插件一行，行 `id` 与 `name` 正确
- [ ] `lib\index.js` 存在并导出 `apply`
- [ ] UI 插件 `lib\client.js` 已编译，`load({ id })` = 包名
- [ ] 创建 `current` 联接
- [ ] `dsh plugin --profile <profile> add "link:<插件根>\current"`
- [ ] 三层校验：profile 记录、软链 Target、`--dump-config` 出现 `# == <包名>`
- [ ] 重启宿主或硬刷新页面，验证行为
- [ ] 补 `README.md`、`FILES.md`
- [ ] 在仓库 README 登记条目

## 2. 发布新版本

- [ ] 复制或构建到 `<新版本>\`，旧版本保留
- [ ] 更新 `version`，与目录名一致
- [ ] 检查 `config` 覆盖字段完整（整块替换）
- [ ] 排除 `node_modules`、临时文件、`current`
- [ ] 重指 `current`
- [ ] 重启宿主并执行三层校验
- [ ] 记录变更与配置迁移说明
- [ ] 保留至少一个可回滚版本

## 3. 回滚

- [ ] 确认目标版本目录存在
- [ ] 删除 `current` 联接（无尾随反斜杠、无 `-Recurse`）
- [ ] 重建联接指向旧版本
- [ ] 重启宿主
- [ ] 三层校验
- [ ] 确认配置/数据兼容
- [ ] 记录回滚原因

## 4. 卸载

- [ ] `dsh plugin --profile <profile> remove <包名>`
- [ ] 确认 `dependencies` 与 `dsh.profile.bundles` 中已移除
- [ ] 清理 home 层托管区块残留行
- [ ] 删除 `current` 联接，再删除插件目录
- [ ] 更新仓库 README
- [ ] 需要时先备份插件状态文件

## 5. 管理器变更

- [ ] 单层结构，两个半边齐备
- [ ] 仅写自有托管区块；区块外不修改
- [ ] 仅操作自有命名空间；拒绝官方包与关键行
- [ ] 写前解析真实行 id
- [ ] 原子写、幂等
- [ ] 未知/禁止 id 返回错误
- [ ] 切换后提示刷新
- [ ] README 记录与宿主自带管理的边界
- [ ] `--dump-config` 验证只有管理器这一层在改目标行

## 6. 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| `add` 成功但组合树无条目 | 缺 `dsh.bundle.patch`、patch 路径错误、装错 profile | 修复后重新 `add` |
| 软链 Target 指向版本目录 | 注册路径错误 | `remove` 后用 `current` 重新 `add` |
| 设置页无插件 | 仅宿主半边、缺 `exports["./client"]`、未重启 | 补齐两半边后重启 |
| `loaded without registering` | `load({ id })` ≠ 包名，factory 未返回 `apply` | 统一 id，修 factory |
| `declares dsh.client but exports no "./client" bundle` | `dsh.client` 与 `exports` 不匹配 | 补 `"./client"` |
| `import failed` / 宿主启动失败 | 宿主入口错误；保存时写入半文件 | 修入口；原子发布；重启 |
| `Cannot find module 'x'` | 非基线模块未内联/声明 | 编译期内联或 `dsh.client.external` |
| `patch: entry "<id>" not found` | 托管区块/手写 patch 引用不存在行 | 删除对应行或重写区块 |
| `patch: name mismatch ... skipping` | patch `name` 与包名不符 | 改为包名，含 `@` 加引号 |
| 开关无效果 | 更高层 patch 覆盖；两个控制面管理同一行；仅改内存态 | 查 `patched by`；保留单一控制面 |
| 改代码无效果 | 改的是宿主半边或未刷新/重启 | 宿主侧重启；浏览器侧 Ctrl+F5 |
| 换版本无变化 | 未重指 `current`、未重启、浏览器缓存 | 重指 + 重启 + 硬刷新 |
| `--dump-config` 被拒绝 | profile 被宿主独占 | 影子 profile（`03` §3） |
| 移动仓库后全部失效 | `link:` 记录绝对路径 | 逐个 `remove` / `add`；不移动根目录 |
| 删除 `current` 后目标目录丢失 | 删除时带尾随反斜杠或 `-Recurse` | 从备份恢复；后续按安全写法删除 |
| 管理器设置页不显示 | 未注册、未重启、缺浏览器半边 | 检查 `dsh.client` / `exports["./client"]`，重启 |

## 7. 命令

```powershell
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"
Get-ChildItem "$env:DSH_HOME\profiles\<profile>\node_modules" -Force |
  Where-Object Name -eq '<包名>' | Select-Object Name, LinkType, Target
dsh plugin --profile <profile> why <包名>
dsh --profile <profile> --dump-config
dsh --profile <profile> --dump-default-config
dsh --profile <profile> --dump-config-schema
dsh --profile <profile> --patch .\extra.yml --dump-config
Test-Path "<插件根>\current"
(Get-Item "<插件根>\current").Target
```
