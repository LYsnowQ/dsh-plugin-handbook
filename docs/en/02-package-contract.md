# 02 · Package Contract

The package root is the version layer containing `package.json`.

## 1. Bundles and the two halves

A bundle is an npm package declaring `dsh.bundle.patch`. The patch inserts plugin rows into the composition
tree; a row's `name` resolves the module.

| | Host half | Browser half |
|---|---|---|
| Entry | `exports["."]` (or `main`) | `exports["./client"]` |
| Declaration | `dsh.bundle.patch` | additionally `dsh.client` |
| Runtime | host Node process | page `window.__ModuleLoader__` |
| Build | none; source runs directly | must be prebuilt |

Declaring `dsh.client` without `lib\client.js` / `exports["./client"]` fails at load time.
A host-only plugin has no settings-page entry; this is expected.

## 2. `package.json`

| Field | Required | Description |
|---|---|---|
| `name` | yes | package name = browser module id = patch `name` assertion = profile dependency name |
| `version` | yes | must match the version directory name |
| `private` | recommended | `true` for local packages |
| `type` | yes | `"module"` when the host half uses ESM |
| `exports` | yes | at least `"."`; UI plugins add `"./client"` |
| `main` | optional | `exports` takes precedence |
| `dsh.bundle.patch` | yes | relative path to the patch file |
| `dsh.client` | required for UI plugins | `platform: "web"`; optional `immediately`, `inject`, `external` |
| `files` | recommended | packaging allowlist; does not filter `link:` installs |
| `description` | recommended | shown in inventories |
| `license` | recommended | retain upstream licenses for third-party packages |

`dsh.client`:

| Field | Description |
|---|---|
| `platform` | `"web"` |
| `immediately` | mount at startup or on demand |
| `inject` | client plugin ids this plugin depends on |
| `external` | extra ids resolved from the module table; non-baseline dependencies must be declared here or inlined at build time |

## 3. Host plugin

```json
{
  "name": "my-notes",
  "version": "1.2.0",
  "private": true,
  "type": "module",
  "description": "Local notes read/write",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" }
  },
  "files": ["lib", "cordis.patch.yml", "README.md", "FILES.md"]
}
```

```js
export const inject = ['tools']

export function apply(ctx, config) {
  return ctx.effect(() => {
    // register tools / routes / listeners
  })
}
```

A service class may be the default export instead; do not mix both export forms.

## 4. Browser UI plugin

```json
{
  "name": "@acme/dsh-notes-panel",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true, "inject": [] }
  },
  "files": ["lib", "locale", "icon.svg", "cordis.patch.yml", "README.md", "FILES.md"]
}
```

```js
export function apply() {}
```

```js
window.__ModuleLoader__.load({
  id: '@acme/dsh-notes-panel',          // must equal package.json name
  factory(require) {
    const React = require('react')
    const h = React.createElement

    function Panel() {
      return h('div', { className: 'notes-panel' }, 'Hello')
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'notes-panel', order: 30, label: () => 'Notes' },
            Panel,
          ),
        )
      },
    }
  },
})
```

Browser half constraints:

- classic script; no top-level `import` / `export` / JSX;
- entry `window.__ModuleLoader__.load({ id, factory })`, `id` = package name;
- `factory` returns `{ inject?, apply }`; register side effects inside `apply` and return cleanup functions;
- `require()` is limited to platform baseline modules (`react`, `react-dom`, `@deepseek-ai/dsh-client-ui-slots`,
  `@deepseek-ai/dsh-client-ui-primitives`, etc., per the current DSH version);
  other dependencies must be inlined at build time or declared in `dsh.client.external`;
- inline assets (data URI) or export them as package files;
- do not replace the app root, append a second app to `document.body`, or read other plugins' DOM/styles;
- route visible text through the client locale service; do not hardcode translations.

## 5. `cordis.patch.yml`

```yaml
# declares this plugin only
- insert:
    - id: my-notes                 # local row id, unique within the composition
      name: 'my-notes'             # package name (assertion); quote if it contains @
      # config: {}
```

- top level must be a YAML array;
- `id` is the row id and need not equal the package name (collections and theme plugins usually use a prefix);
  it must be unique within the composition;
- `name` is the package name, not the row id; a mismatch skips the entire patch (`04` §5);
- `config` is replaced as a whole;
- to insert into a group, use `id: <group id>` + `insert: [...]`.

## 6. Display metadata

The manager and inventories read the following without activating the plugin:

- `locale/en.json`, `locale/zh.json`:

```json
{ "meta": { "title": "Notes Panel", "description": "Manage local notes in settings." } }
```

- `exports["./icon"]` pointing to a package-local icon: SVG / PNG / JPEG / WebP, ≤ 256 KiB;
- a top-level `package.json` `icon` takes precedence over `./icon`;
- missing values fall back to `name` / `description` and the default artwork.

## 7. Name consistency

| Location | Value |
|---|---|
| `package.json` `name` | `my-notes` |
| `load({ id })` | `my-notes` |
| patch row `name` | `'my-notes'` |
| profile dependency / `dsh.profile.bundles` | `my-notes` |

The row `id` is a separate concept and may differ from the package name, but patch and managed block must agree.

## 8. Error reference

| Symptom | Cause | Fix |
|---|---|---|
| `declares dsh.client but exports no "./client" bundle` | `dsh.client` set but `exports["./client"]` missing | add export and `lib/client.js` |
| `loaded without registering` | `load({ id })` ≠ package name, or factory returns no `apply` | unify id; fix factory |
| `import failed` | host entry syntax/dependency error, or partially written file | fix entry; atomic publish |
| `Cannot find module 'x'` | non-baseline module used without inline/declaration | inline at build time or `dsh.client.external` |
| `patch: name mismatch ... skipping` | patch `name` differs from package name | use the package name; quote if needed |
| registered but no row in composition | missing `dsh.bundle.patch` or wrong patch path | fix field/path and reinstall |
| plugin treated as a plain dependency | `package.json` not at the version layer, or an extra directory level | fix layout |
| no entry in manager UI | host-only, or `dsh.client` missing | add both halves |
