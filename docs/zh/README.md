# DSH 插件管理规范（中文）

[English](../en/README.md) | **简体中文**

DSH（DeepSeek Harness）插件的目录层级、包契约、生命周期、patch 优先级与管理器约束。面向维护者与 AI agent。

仓库结构：`docs/zh/`（中文）、`docs/en/`（英文）、`templates/`（模板与脚本）。

## 文档

| 文件 | 内容 |
|---|---|
| [01-hierarchy.md](01-hierarchy.md) | 目录层级、命名、`current` 联接、合集、管理层 |
| [02-package-contract.md](02-package-contract.md) | `package.json`、宿主/浏览器半边、`cordis.patch.yml` |
| [03-lifecycle.md](03-lifecycle.md) | `dsh plugin`、三层校验、影子 profile、生效方式 |
| [04-patch-layers.md](04-patch-layers.md) | 四层 patch、分配规则、语法、托管区块 |
| [05-manager-spec.md](05-manager-spec.md) | 管理器形态、命名空间、写入与安全约束 |
| [06-conventions.md](06-conventions.md) | 编码、换行、命名、文档分工 |
| [07-checklist.md](07-checklist.md) | 操作清单、排错表、命令 |
| [English](../en/README.md) | English documentation |
| [templates/](../../templates/) | 可复制模板与 `new-plugin.ps1` |
| [AGENTS.md](../../AGENTS.md) | agent 入口与首次接入约束 |

## 目录树

`%PLUGIN_ROOT%` 为被管理插件仓库根；本仓库只提供规范、模板与脚本。

```text
%PLUGIN_ROOT%\
├── README.md
├── PLUGINS.md                      # 可选：01–07 合订本
├── <包名>\                          # 独立插件
│   ├── current -> <版本>\           # Junction；注册路径固定走这里
│   ├── <版本>\                      # 版本层 = 包根
│   │   ├── package.json
│   │   ├── cordis.patch.yml
│   │   ├── lib\
│   │   │   ├── index.js            # 宿主半边
│   │   │   └── client.js           # 浏览器半边（UI 插件）
│   │   ├── assets\
│   │   ├── README.md
│   │   └── FILES.md
│   └── <旧版本>\
├── <合集名>\                        # 合集（可选）
│   ├── README.md
│   ├── current -> <合集版本>\
│   └── <合集版本>\
│       ├── <子目录A>\               # 每个子目录是完整插件包
│       └── <子目录B>\
└── <管理器>\                        # 管理层（可选，单层）
    ├── package.json
    ├── cordis.patch.yml
    ├── lib\{index,client}.js
    ├── resources\
    ├── README.md
    └── FILES.md
```

## 不变量

1. 顶层目录名 = 包名（作用域包见 `01`；合集与管理层为结构例外）。
2. 包根 = 含 `package.json` 的版本层；注册路径固定为 `<插件>\current`，不注册版本目录。
3. 版本目录为只读快照；变更发新版本，就地修改必须留 `LOCAL-PATCH.md`。
4. 启停只用 patch 的 `disabled`；patch 没有删除语法。
5. 层序：bundle → profile → home → `--patch`；home 压过 profile。

## 命令约定

- `dsh` 指与安装方式匹配的 CLI。
- `$env:DSH_HOME` 为 DSH 数据根目录，通常 `$env:USERPROFILE\.dsh`；未设置时按此替换。
- `<profile>` 为 profile 名占位符；不同 profile 的插件互不影响。
- 示例路径 `D:\dsh-plugins` 表示插件仓库根，可替换。

## 最小流程

```powershell
$root = "D:\dsh-plugins\example-plugin"

# 版本目录就绪后建联接
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.0.0"

# 注册 current
dsh plugin --profile <profile> add "link:$root\current"

# 校验
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"
dsh --profile <profile> --dump-config | Select-String 'example-plugin'
```

生效：宿主半边/`package.json`/patch/重指 `current` → 重启宿主；纯浏览器半边 → 硬刷新；patch 的 `disabled` → 热重载后刷新页面。

## 首次接入（agent）

首次处理某环境的 DSH 插件时，按顺序执行：

1. **只读盘点**：列出已装插件、版本、注册路径、所属 profile、patch 层现状。不改文件。
2. **向用户确认**：
   - 是否将现有插件纳入本规范管理；
   - `%PLUGIN_ROOT%` 位置。禁止放在 DSH 安装目录、`$DSH_HOME`、`profiles\<name>\`、`node_modules` 内；禁止与 DSH 应用同目录（升级/重装/清理会整体删除）；推荐独立目录，如 `D:\dsh-plugins`；
   - 目标 profile。
3. **输出迁移计划**：目录调整、`link:` 重注册清单、回滚方式。用户确认后执行。
4. 确认前禁止：删除/移动插件、改 profile 的 `package.json` 或 patch、执行 `remove`。

迁移已有插件会使原 `link:` 失效，需逐个 `remove` 后重新 `add`（见 `03`）。

将本仓库交给 agent 时，agent 必须先完成以上确认再操作。
