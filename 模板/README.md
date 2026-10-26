# 模板

占位符：`__NAME__`（包名）、`__VERSION__`、`__ROW_ID__`（行 id）、`__DESCRIPTION__`、
`__MANAGER_ID__`（管理器标识）。

| 文件 | 用途 |
|---|---|
| `package.host.json.template` | 宿主插件 `package.json` |
| `package.client.json.template` | 带浏览器界面的插件 `package.json` |
| `cordis.patch.yml` | bundle patch |
| `home.cordis.patch.yml` | home 层补丁与托管区块骨架 |
| `new-plugin.ps1` | 生成版本目录 + `current` 联接，不自动注册 |

脚本：

```powershell
.\new-plugin.ps1 -Name my-notes -Version 1.0.0 -Root D:\dsh-plugins -Description "本地笔记"
.\new-plugin.ps1 -Name my-notes-panel -Version 0.1.0 -Root D:\dsh-plugins -UI
```

说明：

- JSON 模板中的占位符为字符串，替换后才可使用。
- `package.client.json.template` 默认导出 `./locale/*.json` 与 `./icon`；无对应文件时删除这两行
  及 `files` 中的相应项。
- `new-plugin.ps1` 为 UTF-8 BOM 脚本（兼容 Windows PowerShell 5.1）；生成的文件为 UTF-8 无 BOM。
  `package.json` 由 `ConvertTo-Json` 输出，缩进随 PowerShell 版本不同。
- `home.cordis.patch.yml` 的区块内条目由管理器写入，手工只改区块外。
