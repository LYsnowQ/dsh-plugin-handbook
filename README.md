# DSH Plugin Handbook

**English** | [简体中文](docs/zh/README.md) | [Full English docs](docs/en/README.md)

A bilingual specification for DSH (DeepSeek Harness) plugin management: directory hierarchy, package contract,
lifecycle, patch-layer priority, and manager constraints. Intended for maintainers and AI agents.

This repository contains documentation, templates, scripts, and two reference manager plugins.
It is not itself an installable package; the manager directories can be copied or registered as bundles.

中文摘要：本仓库提供 DSH 插件管理规范的中英双语版本，覆盖目录层级、插件包契约、安装升级、patch 层优先级与管理器约束。
另附两个可复用的管理插件参考实现：`plugin-manager` 与 `skins/skin-manager`。
中文完整文档见 [docs/zh/](docs/zh/README.md)。

## Repository layout

```text
.
├── README.md
├── AGENTS.md                 # agent entry point and first-run constraints
├── LICENSE
├── docs/
│   ├── en/                   # English documentation
│   │   ├── README.md
│   │   ├── 01-hierarchy.md
│   │   ├── 02-package-contract.md
│   │   ├── 03-lifecycle.md
│   │   ├── 04-patch-layers.md
│   │   ├── 05-manager-spec.md
│   │   ├── 06-conventions.md
│   │   └── 07-checklist.md
│   └── zh/                   # 中文文档（同名文件）
├── plugin-manager/           # reference plugin manager (dsh-plugin-manager)
├── skins/
│   └── skin-manager/         # reference skin manager (dsh-skin-manager)
└── templates/                # package/patch templates and new-plugin.ps1
```

## Reference managers

| Directory | Package | Purpose |
|---|---|---|
| `plugin-manager/` | `dsh-plugin-manager` | lists third-party bundles in settings and toggles them via the home-layer managed block |
| `skins/skin-manager/` | `dsh-skin-manager` | treats skins as resources, single-select, toggles `ui-skin-*` rows |

```powershell
# register the managers; the repository root can serve as %PLUGIN_ROOT%
dsh plugin --profile <profile> add "link:<repo>\plugin-manager"
dsh plugin --profile <profile> add "link:<repo>\skins\skin-manager"
```

Both managers ship with empty registries: `plugin-manager/resources/registry.json` and
`skins/skin-manager/resources/skins.json`. No third-party plugins, skins, or skin CSS are included.
The managers scan the active profile and populate their registries as plugins are toggled; skins require
manifest entries and CSS files supplied by the user. UI strings are Chinese and can be adapted.

## Core rules

- One top-level directory per plugin; the directory name derives from the package name (`01` covers scoped
  packages). Collections and management layers are the only structural exceptions.
- The package root is the version layer containing `package.json`; register `<plugin>\current`, never a version
  directory.
- Version directories are read-only snapshots. Local edits require `LOCAL-PATCH.md`; writes use temp file + rename.
- Enable/disable uses patch `disabled` only. Patches have no delete syntax.
- Layer order: bundle → profile → home → `--patch`. The home layer overrides the profile layer, so a custom manager
  writing home wins over the host plugin manager writing profile.

## First run

An agent handed this repository must complete these steps before changing anything:

1. Read-only inventory of installed plugins, versions, registration paths, profile, and patch layers.
2. Confirm with the user: whether to bring existing plugins under this specification; the `%PLUGIN_ROOT%` location;
   the target profile.
3. Produce a migration plan (directory changes, `link:` re-registration, rollback) and wait for approval.

`%PLUGIN_ROOT%` must not be the DSH installation directory, `$DSH_HOME`, a profile directory, `node_modules`, or the
same directory as the DSH application. Upgrades, reinstalls, or cleanup may delete that directory wholesale.

中文：agent 首次接入时必须先只读盘点，再向用户确认是否纳管、插件源码目录（不得与 DSH 同目录）和 profile，
给出迁移计划后才能操作；确认前禁止删除、移动、修改注册或执行 `remove`。

## License

MIT. See [LICENSE](LICENSE).
