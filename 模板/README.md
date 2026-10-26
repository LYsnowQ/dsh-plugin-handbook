# 模板说明

本目录是 `01`–`05` 规范的可复制版本。**占位符一律用双下划线大写**，
复制后全局替换即可：

| 占位符 | 替换为 | 例 |
|---|---|---|
| `__NAME__` | 插件包名（`package.json` 的 `name`） | `my-notes` / `@acme/notes` |
| `__VERSION__` | 版本号（与目录名一致） | `1.0.0` |
| `__ROW_ID__` | 行 id（组合树里的本地 id） | `my-notes` / `ui-notes-panel` |
| `__DESCRIPTION__` | 一句话说明 | `本地笔记读写` |
| `__MANAGER_ID__` | 管理器标识（建议等于包名） | `my-plugin-manager` |

## 文件

| 文件 | 用途 |
|---|---|
| `package.host.json.template` | 只有宿主半边的插件 |
| `package.client.json.template` | 带浏览器界面（设置页/插槽 UI）的插件 |
| `cordis.patch.yml` | 挂载声明（bundle patch） |
| `home.cordis.patch.yml` | home 层补丁 + 托管区块骨架 |
| `new-plugin.ps1` | 一条命令生成上面的目录与文件，并建 `current` 联接 |

## 用法

### 方式一：跑脚本（推荐）

```powershell
.\new-plugin.ps1 -Name my-notes -Version 1.0.0 -Root D:\dsh-plugins -Description "本地笔记"
# 带浏览器界面：
.\new-plugin.ps1 -Name my-notes-panel -Version 0.1.0 -Root D:\dsh-plugins -UI
```

脚本只生成文件与联接，**不会**自动注册；结束时会打印注册命令。

### 方式二：手动复制

1. 建 `%PLUGIN_ROOT%\<包名>\<版本>\lib\`；
2. 把对应的 `package.*.json.template` 复制成 `<版本>\package.json`，替换占位符；
3. 复制 `cordis.patch.yml`，替换 `__ROW_ID__` / `__NAME__`；
4. 写 `lib\index.js`（宿主半边）与可选的 `lib\client.js`（浏览器半边）；
5. 建 `current` 联接。

## 注意

- JSON 模板里的占位符是**字符串**，替换完才是合法包名/版本；不要直接把带 `__` 的文件当成品。
- `package.client.json.template` 里默认导出了 `./locale/*.json` 与 `./icon`。
  如果暂时不做图标/本地化，请把这两行 `exports` 以及 `files` 里对应的
  `"locale"`、`"icon.svg"` 删掉，避免清单里出现指向不存在文件的条目。
- `package.client.json.template` 里的 `inject: []` 是空依赖列表；有客户端插件依赖时再填。
- `home.cordis.patch.yml` 只是骨架：区块内的条目由管理器写，手工只改区块外。
- `new-plugin.ps1` 会创建 Windows 目录联接（Junction），不需要管理员权限；
  它**不会**自动注册插件，注册命令在结束时打印。
- `new-plugin.ps1` 保存为**带 UTF-8 BOM** 的脚本（Windows PowerShell 5.1 会把无 BOM 的
  UTF-8 当 ANSI 读，中文会乱码）；它用 .NET 写出的插件文件仍是**无 BOM** 的 UTF-8。
- 脚本生成的 `package.json` 走 `ConvertTo-Json`，不同 PowerShell 版本的缩进略有差异
  （PS7 约 2 空格，PS5.1 约 4 空格）；内容合法，提交前按团队格式化规则统一即可。
