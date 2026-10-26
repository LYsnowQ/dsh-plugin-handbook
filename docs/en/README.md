# DSH Plugin Handbook (English)

**English** | [简体中文](../zh/README.md)

Directory hierarchy, package contract, lifecycle, patch priority, and manager constraints for DSH
(DeepSeek Harness) plugins. Intended for maintainers and AI agents.

Repository layout: `docs/en/` (English), `docs/zh/` (Chinese), `templates/` (templates and scripts).

## Documentation

| File | Content |
|---|---|
| [01-hierarchy.md](01-hierarchy.md) | directory hierarchy, naming, `current` junction, collections, management layer |
| [02-package-contract.md](02-package-contract.md) | `package.json`, host/browser halves, `cordis.patch.yml` |
| [03-lifecycle.md](03-lifecycle.md) | `dsh plugin`, three-layer verification, shadow profile, activation |
| [04-patch-layers.md](04-patch-layers.md) | patch layers, allocation rules, syntax, managed blocks |
| [05-manager-spec.md](05-manager-spec.md) | manager form, namespaces, write and safety constraints |
| [06-conventions.md](06-conventions.md) | encoding, line endings, naming, documentation split |
| [07-checklist.md](07-checklist.md) | checklists, troubleshooting, commands |
| [简体中文](../zh/README.md) | Chinese documentation |
| [templates/](../../templates/) | copyable templates and `new-plugin.ps1` |
| [AGENTS.md](../../AGENTS.md) | agent entry point and first-run constraints |

## Directory tree

`%PLUGIN_ROOT%` is the root of the managed plugin repository; this repository only provides the
specification, templates, and scripts.

```text
%PLUGIN_ROOT%\
├── README.md
├── PLUGINS.md                      # optional: combined 01–07
├── <package-name>\                 # standalone plugin
│   ├── current -> <version>\       # junction; the only registered path
│   ├── <version>\                  # version layer = package root
│   │   ├── package.json
│   │   ├── cordis.patch.yml
│   │   ├── lib\
│   │   │   ├── index.js            # host half
│   │   │   └── client.js           # browser half (UI plugins)
│   │   ├── assets\
│   │   ├── README.md
│   │   └── FILES.md
│   └── <old-version>\
├── <collection-name>\              # collection (optional)
│   ├── README.md
│   ├── current -> <collection-version>\
│   └── <collection-version>\
│       ├── <subdir-a>\             # each subdirectory is a complete plugin package
│       └── <subdir-b>\
└── <manager>\                      # management layer (optional, single layer)
    ├── package.json
    ├── cordis.patch.yml
    ├── lib\{index,client}.js
    ├── resources\
    ├── README.md
    └── FILES.md
```

## Invariants

1. A top-level directory name equals the package name (scoped packages per `01`; collections and management
   layers are structural exceptions).
2. The package root is the version layer containing `package.json`; register `<plugin>\current` only,
   never a version directory.
3. Version directories are read-only snapshots; changes ship as a new version, and in-place edits require
   `LOCAL-PATCH.md`.
4. Enable/disable is expressed only through patch `disabled`; patches have no delete syntax.
5. Layer order: bundle → profile → home → `--patch`; home overrides profile.

## Command conventions

- `dsh` is the CLI matching the installation method.
- `$env:DSH_HOME` is the DSH data root, normally `$env:USERPROFILE\.dsh`; substitute it when unset.
- `<profile>` is a profile name placeholder; plugins in different profiles are independent.
- Example paths such as `D:\dsh-plugins` denote the plugin repository root and may be replaced.

## Minimal flow

```powershell
$root = "D:\dsh-plugins\example-plugin"

# create the junction after the version directory exists
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.0.0"

# register current
dsh plugin --profile <profile> add "link:$root\current"

# verify
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"
dsh --profile <profile> --dump-config | Select-String 'example-plugin'
```

Activation: host half / `package.json` / patch / repointed `current` → restart the host; browser-only changes →
hard refresh; patch `disabled` → hot reload, then refresh the page.

## First run (agent)

When handling DSH plugins in an environment for the first time, execute in order:

1. **Read-only inventory**: list installed plugins, versions, registration paths, profile, and current patch layers.
   Do not modify files.
2. **Confirm with the user**:
   - whether to bring existing plugins under this specification;
   - the `%PLUGIN_ROOT%` location. Prohibited: the DSH installation directory, `$DSH_HOME`, `profiles\<name>\`,
     or `node_modules`; do not use the same directory as the DSH application (upgrades/reinstalls/cleanup may
     delete it wholesale). Use a standalone directory such as `D:\dsh-plugins`;
   - the target profile.
3. **Produce a migration plan**: directory changes, `link:` re-registration list, rollback method. Execute after
   user confirmation.
4. Before confirmation, do not: delete/move plugins, modify the profile `package.json` or patches, or run `remove`.

Migrating an existing plugin invalidates its `link:`; `remove` and re-`add` each one (see `03`).

An agent handed this repository must complete the confirmations above before operating.
