# Templates

Placeholders: `__NAME__` (package name), `__VERSION__`, `__ROW_ID__` (row id), `__DESCRIPTION__`,
`__MANAGER_ID__` (manager id).

| File | Purpose |
|---|---|
| `package.host.json.template` | host-only plugin `package.json` |
| `package.client.json.template` | UI plugin `package.json` |
| `cordis.patch.yml` | bundle patch |
| `home.cordis.patch.yml` | home-layer patch and managed-block skeleton |
| `new-plugin.ps1` | scaffold version directory + `current` junction; does not register |

```powershell
.\new-plugin.ps1 -Name my-notes -Version 1.0.0 -Root D:\dsh-plugins -Description "local notes"
.\new-plugin.ps1 -Name my-notes-panel -Version 0.1.0 -Root D:\dsh-plugins -UI
```

Notes:

- Replace placeholders before use; JSON templates are not valid manifests while placeholders remain.
- `package.client.json.template` exports `./locale/*.json` and `./icon` by default. Remove those exports and the
  matching `files` entries if the package does not provide them.
- `new-plugin.ps1` is a UTF-8 BOM script (Windows PowerShell 5.1 compatibility) and generates UTF-8 files without
  BOM. `package.json` is emitted by `ConvertTo-Json`; indentation varies by PowerShell version.
- `new-plugin.ps1` comments, console output, and generated `README.md` / `FILES.md` are Chinese. For an English
  scaffold, copy the JSON/YAML templates directly.
- Managed entries inside `home.cordis.patch.yml` are written by a manager; manual edits go outside the block.

## 中文

占位符：`__NAME__`（包名）、`__VERSION__`、`__ROW_ID__`（行 id）、`__DESCRIPTION__`、`__MANAGER_ID__`（管理器标识）。

| 文件 | 用途 |
|---|---|
| `package.host.json.template` | 宿主插件 `package.json` |
| `package.client.json.template` | 带浏览器界面的插件 `package.json` |
| `cordis.patch.yml` | bundle patch |
| `home.cordis.patch.yml` | home 层补丁与托管区块骨架 |
| `new-plugin.ps1` | 生成版本目录 + `current` 联接，不自动注册 |

说明：

- 使用前替换占位符；占位符保留时 JSON 模板不是合法清单。
- `package.client.json.template` 默认导出 `./locale/*.json` 与 `./icon`；无对应文件时删除这两行及 `files` 中的相应项。
- `new-plugin.ps1` 为 UTF-8 BOM 脚本（兼容 Windows PowerShell 5.1），生成 UTF-8 无 BOM 文件；
  `package.json` 由 `ConvertTo-Json` 输出，缩进随 PowerShell 版本不同。
- `home.cordis.patch.yml` 的区块内条目由管理器写入，手工修改只写区块外。
