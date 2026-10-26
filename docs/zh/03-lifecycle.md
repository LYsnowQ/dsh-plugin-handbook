# 03 · 安装、升级与卸载

## 1. 安装

```powershell
# 同名旧包先卸载
dsh plugin --profile <profile> remove <包名>

# 注册 current（绝对路径）
dsh plugin --profile <profile> add "link:D:\dsh-plugins\<包名>\current"

# 一次多个
dsh plugin --profile <profile> add "link:D:\dsh-plugins\a\current" "link:D:\dsh-plugins\b\current"
```

`dsh plugin --profile <name> <args...>` 将参数转发给 profile 目录下的 pnpm，成功后：

1. profile `dependencies` 写入 `"<包名>": "link:<绝对路径>"`；
2. `dsh.profile.bundles` 追加包名；
3. `node_modules` 生成软链。

profile 首次使用会自动初始化（含 `@deepseek-ai/dsh-base`）。需要 Web 界面的临时 profile 用启动命令建模板：

```powershell
dsh --profile <name> --from-default-profile web --dump-config
```

禁止：手工修改 profile 的 `package.json` / `dsh.profile.bundles`；使用相对路径；注册版本目录。

## 2. 三层校验

```powershell
# 1) profile 记录
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"

# 2) 软链 Target 应以 ...\<包名>\current 结尾
Get-ChildItem "$env:DSH_HOME\profiles\<profile>\node_modules" -Force |
  Where-Object Name -eq '<包名>' | Select-Object Name, LinkType, Target

# 3) 组合树应出现 "# == <包名>"
dsh --profile <profile> --dump-config | Select-String '<包名>|not found|skipped'
```

`--dump-config` 判读：

- `# == <包名>`：bundle 已进入组合；
- `patched by <路径列表>`：命中的 patch 层，按应用顺序；
- `disabled: true`：该行被禁用；
- `not found` / `skipped` / `name mismatch`：异常。

`--dump-default-config` 打印不含用户层的组合；`--dump-config-schema` 打印行 schema。

## 3. 影子 profile

宿主独占 profile（启动与 `--dump-config` 被拒绝）时，使用临时 `DSH_HOME` 复刻校验：

```powershell
$vh = Join-Path $env:TEMP 'dsh-verify-home'
$pd = "$vh\profiles\check"
New-Item -ItemType Directory -Force -Path $pd | Out-Null

$m = Get-Content -Raw "$env:DSH_HOME\profiles\<profile>\package.json" | ConvertFrom-Json
$m.name = 'dsh-profile-check'
$json = $m | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText("$pd\package.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Copy-Item "$env:DSH_HOME\profiles\<profile>\cordis.patch.yml" "$pd\cordis.patch.yml" -ErrorAction SilentlyContinue

$env:DSH_HOME = $vh
dsh plugin --profile check install
dsh --profile check --dump-config | Select-String '<包名>|not found|skipped'

Remove-Item -Recurse -Force $vh
```

- 临时 profile 名不得使用被宿主独占的名称；
- `package.json` 必须 UTF-8 无 BOM；PowerShell 5.1 的 `-Encoding utf8` 会写 BOM；
- `$env:DSH_HOME` 仅当前会话有效。

## 4. 升级

```powershell
$root = "D:\dsh-plugins\my-notes"

# 1) 新版本放入 <root>\1.3.0\，旧版本保留
# 2) 重指 current
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.3.0"
# 3) 重启宿主
```

注册路径未变，不需要重新 `add`。升级后重跑三层校验。

## 5. 回滚

```powershell
Remove-Item "D:\dsh-plugins\my-notes\current" -Force
New-Item -ItemType Junction -Path "D:\dsh-plugins\my-notes\current" -Target "D:\dsh-plugins\my-notes\1.2.0"
```

旧版本仍在，无需重装。回滚后重跑三层校验。

## 6. 卸载

```powershell
dsh plugin --profile <profile> remove <包名>
```

仅解注册，不删除文件。清理顺序：

```powershell
Remove-Item "D:\dsh-plugins\my-notes\current" -Force     # 1) 删联接
Remove-Item -Recurse -Force "D:\dsh-plugins\my-notes"    # 2) 删目录
```

home 层托管区块若残留该行 id，启动时产生 `patch: entry "<id>" not found` 警告，删除对应行或让管理器重写区块。

## 7. 生效方式

| 改动 | 生效 |
|---|---|
| `lib\client.js` / 浏览器侧静态资源 | 硬刷新（Ctrl+F5） |
| `lib\index.js` | 重启宿主 |
| `package.json` / `cordis.patch.yml` / 依赖 | 重启宿主 |
| 重指 `current` | 重启宿主 |
| profile / home 层 patch 的 `disabled` | 热重载组合，不重启服务；刷新页面 |
| 管理器资源文件 | 刷新页面；有宿主侧缓存时重启 |

## 8. 原子发布

`link:` 安装直接读取版本目录。就地修改必须使用临时文件 + rename，避免宿主读到半文件：

```powershell
$tmp = "$target.new"
# 写入完整内容
Move-Item -Path $tmp -Destination $target -Force
```

涉及宿主半边时重启；仅浏览器半边时硬刷新。修改记录到 `LOCAL-PATCH.md`。

## 9. 常见失败

| 现象 | 原因 | 处理 |
|---|---|---|
| `add` 找不到路径 | 相对路径 / 路径错误 / `current` 未创建 | 绝对路径；先建联接 |
| `add` 成功但组合树无条目 | 缺 `dsh.bundle.patch` 或 patch 文件缺失 | 修复后重新 `add` |
| 条目被 `skipped` | patch `name` 与包名不符 | 修改 `name` |
| 软链 Target 指向版本目录 | 注册路径错误 | `remove` 后用 `current` 重新 `add` |
| 升级后仍加载旧代码 | 未重指 `current` 或未重启 | 重指 + 重启 |
| `import failed` | 就地保存被读到半文件 | 原子发布 + 重启 |
| 同名包冲突 | 曾从其他路径安装 | 先 `remove` 再 `add` |

## 10. 命令

```powershell
dsh plugin --profile <profile> add "link:<插件根>\current"
dsh plugin --profile <profile> remove <包名>
dsh plugin --profile <profile> why <包名>
dsh plugin --profile <profile> install

dsh --profile <profile> --dump-config
dsh --profile <profile> --dump-default-config
dsh --profile <profile> --dump-config-schema
dsh --profile <profile> --patch .\extra.yml --dump-config
```
