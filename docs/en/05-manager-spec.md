# 05 · Manager Specification

A manager is a plugin that manages plugin enable/disable: it provides switches or a single-select UI in the
host settings page and applies changes by writing patches.

## 1. Scope

| Responsible for | Not responsible for |
|---|---|
| Enable/disable of third-party and custom plugins | Install/uninstall (`dsh plugin`) |
| Single-select switching for collections | Plugin configuration (`Config` / settings namespace) |
| Settings-page management UI | Official/kernel rows, host-critical rows |
| Its own managed block and registry | Other managers' blocks, user-written patch entries |

## 2. Layout

```text
<manager>\
├── package.json            # dsh.bundle.patch + dsh.client
├── cordis.patch.yml        # inserts the manager itself only
├── lib\
│   ├── index.js            # host half
│   └── client.js           # browser half
├── resources\              # optional
├── README.md
└── FILES.md
```

- single layer: no version directory, no `current`;
- both halves are required: without `lib\client.js` / `exports["./client"]` there is no settings entry;
- managed resources live in the manager directory and need not be standalone plugins;
- patch state is authoritative; a state file is only a default or metadata.

Host half:

- discover: scan profile `node_modules` (or a host-provided bundle list) for third-party packages declaring
  `dsh.bundle.patch`;
- resolve: read the bundle patch and obtain the actual row id and `name`;
- read state: read the home-layer managed block;
- write state: rewrite the managed block;
- routes: list, toggle, rescan.

Browser half:

- `window.__ModuleLoader__.load({ id: '<manager-package>', factory })`;
- inject the management UI into `settings.section`;
- call host routes and update the list;
- prompt for a page refresh after switching.

## 3. Identity and block

```yaml
# >>> my-plugin-manager:managed >>>
# my-plugin-manager: managed entries
- id: my-notes
  name: 'my-notes'
  disabled: false
# <<< my-plugin-manager:managed <<<
```

- the manager id is its package name;
- row ids are prefixed by domain (`ui-theme-*`, `tool-*`, `panel-*`); each prefix belongs to one manager;
- entries are sorted by `id`, field order is fixed, and repeated writes are idempotent.

## 4. State source

- the patch is the single source of truth for enable/disable state; rebuild UI state from the managed block at startup;
- a registry (for example `resources\registry.json`) records only which plugins the manager owns, not their state;
- rebuild an empty block when it is missing or corrupt; do not infer content;
- a state file must not override actual values from the patch.

## 5. Hard constraints

1. **Write only the manager's managed block**: read the whole file → locate markers → replace the inner section →
   atomic write. Do not modify anything outside it.
2. **Operate only on row ids in the manager's namespace**:
   - reject `@deepseek-ai/*`;
   - never disable `loader`, `webserver`, `clientModules`, `include`, `hmr`;
   - validate against the current composition; reject unknown ids.
3. **Atomic writes**: the home layer is file-watched; a partial file triggers a failed reload. Use temp file + rename.
4. **Do not race for priority**: gain authority through layers (home 300 > profile 200), not by write order in one file.
5. **Do not lock itself out**: do not manage itself, disable components it depends on, or take over rows that keep
   the manager operational.

## 6. Hot reload

- DSH watches the profile and home patch layers; changes trigger transactional recomposition without restarting
  the HTTP service;
- browsers are not notified automatically; refresh the page after switching;
- do not use `ctx.loader.update(id, { disabled })` instead of writing the file: it is memory-only, and its write-back
  target `cordis.yml` is overwritten at the next startup;
- runtime entry ids are path-qualified (`include:...`), unlike local ids in patches.

## 7. Failure handling

| Case | Handling |
|---|---|
| target id does not exist | reject, return 4xx, prompt rescan |
| target belongs to `@deepseek-ai/*` | reject |
| managed block missing | rebuild from a template containing the markers |
| patch file missing | create a file containing only the block; do not hardcode another plugin's private template path |
| write failure | keep the old file, return an error |
| concurrent writes | serialize in-process; re-read the file before writing |
| stale entry outside the block | do not delete or modify |

## 8. Host built-in plugin manager

DSH may ship its own plugin management (plugin page, `plugin_manager` tool), which writes the profile-layer patch
and `dsh.profile.bundles`. A custom manager writes the home layer. The home layer is applied after the profile layer,
so once a row id is owned by the custom manager, the built-in toggle has no effect.

Constraint: a row id has exactly one control plane. When mixing, inspect `patched by` in `--dump-config`;
the last patch file is the effective layer.
