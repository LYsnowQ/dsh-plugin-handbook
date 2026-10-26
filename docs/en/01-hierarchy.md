# 01 · Directory Hierarchy

## 1. Layout types

| Form | Top-level directory | Version layer | Registration unit |
|---|---|---|---|
| Standalone plugin | `<package-name>\` | `<package-name>\<version>\` | one bundle |
| Collection | `<collection-name>\` | `<collection-name>\<collection-version>\<subdir>\` | one bundle per subdirectory |
| Management layer | `<manager>\` | none (single layer) | one bundle |

A top-level directory is one entry. A collection counts as one entry in the repository but expands into N bundles at registration time.

## 2. Standalone plugin

```text
<package-name>\
├── current             # Junction → active version; the only registered path
├── <version>\          # version layer = package root
│   └── package.json
└── <old-version>\
```

Rules:

1. The first-level directory name equals `package.json` `name`, exactly, without a version suffix.
   - Scoped packages (`@scope/name`) cannot be used directly as directory names: use the unscoped `name`,
     or `<scope>-<name>`, and record the mapping in the plugin README.
2. The second-level directory name equals the `version` field verbatim (`0.3.7`, `0.2.0-rc.2`);
   no `v` prefix, `latest`, or dates.
3. `package.json` must sit exactly at the version layer. An extra same-name directory leaves no
   `package.json` at the registered path, and the package is not loaded as a plugin.
4. The plugin root (`<package-name>\` itself) must not contain a `package.json`.

## 3. `current` junction

`dsh plugin add "link:<path>"` records an absolute path. Once registered, the path must not move or be renamed.
Register `<plugin>\current` only; version switches modify the junction.

Create:

```powershell
$root = "D:\dsh-plugins\my-notes"
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.2.0"
```

Upgrade / rollback:

```powershell
# Upgrade
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.3.0"

# Rollback
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.2.0"
```

Remove the junction:

```powershell
Remove-Item "$root\current" -Force        # no trailing backslash, no -Recurse
```

A trailing backslash or `-Recurse` can follow the junction and delete the target contents.

Prohibited:

- registering `...\my-notes\1.2.0`;
- placing `current` inside a version directory;
- moving or renaming the plugin root or `%PLUGIN_ROOT%` after registration;
- copying the whole plugin root (copies the junction as well).

## 4. Collections

Use for a large number of same-form plugins managed as a group (themes, language packs, presets).

```text
<collection-name>\
├── README.md               # inventory, sources, enable/disable, licenses
├── current -> <collection-version>\
└── <collection-version>\
    ├── <subdir-a>\
    │   ├── package.json
    │   ├── cordis.patch.yml
    │   └── lib\
    └── <subdir-b>\
```

Rules:

1. The collection root must not contain a `package.json`.
2. The collection version is the batch version. If an item has a different version, its own `package.json`
   `version` wins; record it in the collection README.
3. Subdirectory names are short English identifiers matching the plugin's own identifier.
4. Only the collection has a `current` junction; items do not create their own.
5. Register each item explicitly:

   ```powershell
   dsh plugin --profile <profile> add `
     "link:D:\dsh-plugins\<collection>\current\<subdir-a>" `
     "link:D:\dsh-plugins\<collection>\current\<subdir-b>"
   ```

6. Enabling multiple items usually does not fail, but they compete for the same resource/visual slot.
   Collections are normally single-select, controlled by a manager writing the home-layer managed block.
   Do not use `dsh plugin remove` to switch items.

## 5. Management layer

```text
<manager>\
├── package.json            # dsh.bundle.patch + dsh.client
├── cordis.patch.yml        # inserts the manager itself only
├── lib\
│   ├── index.js
│   └── client.js
├── resources\              # optional: registry, resources
├── README.md
└── FILES.md
```

Rules:

1. Single layer: the top level is the package root; no version directory, no `current`.
2. Directory name equals the package name. When named by role, record the mapping in the README.
3. The package name must not collide with a bundled official package.
4. `cordis.patch.yml` only inserts the manager itself; managed plugins are controlled through the
   home-layer managed block.
5. A manager must not manage itself, and must not disable rows it depends on.

A manager inside a collection is also single-layer but lives at `<collection-version>\<manager>\`;
this is the only combination of collection and management layer.

## 6. Version directory snapshot

Version directories are immutable. Change procedures:

1. New version directory + repoint `current` (default).
2. In-place edits require a `LOCAL-PATCH.md` beside the files, recording: files and sections changed,
   reason, how to redo the change after upgrading upstream, whether it was reported upstream.

`link:` installs read the source directory directly. An in-place save may be read half-written and trigger
`import failed`. Write via a temporary file + rename:

```powershell
$tmp = "$target.new"
# write the complete content to $tmp
Move-Item -Path $tmp -Destination $target -Force
```

## 7. Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Localized or repository name as the top-level directory | Mismatch with package name; upgrade/debugging fails |
| Extra same-name directory under the version layer | No `package.json` at the registered path; not loaded |
| `package.json` at the plugin root | Root is mistaken for a package root |
| Backing up or archiving `current` | Restored junction is invalid or becomes a plain directory |
| Registering a version path | Old version loads after upgrade |
| Moving `%PLUGIN_ROOT%` | All `link:` entries break; re-register each |
| Using `remove` as a toggle | Dependencies and bundle entries are removed |
| `node_modules` or `.git` inside a version layer | Snapshot pollution, large size |

## 8. Repository metadata

Not part of the version layer: `.github\`, `.git\`, `.gitignore`, `.gitattributes`, CI configuration,
issue/PR templates.

Part of the version layer: `package.json`, `cordis.patch.yml`, `lib\`, `assets\`, `locale\`, `README.md`,
`LICENSE`, `NOTICE`, `PROVENANCE.md`. Third-party `LICENSE` / `NOTICE` files must be retained.
