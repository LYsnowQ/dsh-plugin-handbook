# dsh-skin-manager

Reference implementation of a skin manager for DSH. It treats skins as **resources**, not as loaded plugins:
the manager serves their CSS and enforces single-select through the home-layer managed block.

## Behavior

- Adds a **Skins** section to the host settings page (single-select).
- Reads `resources/skins.json` and serves one CSS file per entry.
- Writes the selected skin to `$DSH_HOME/cordis.patch.yml`:

```yaml
# >>> dsh-skin-manager:managed >>>
- id: ui-skin-example
  name: '@acme/dsh-client-ui-skin-example'
  disabled: false
# <<< dsh-skin-manager:managed <<<
```

- All other managed skins are written with `disabled: true`.
- Content outside the block is preserved.

## Manifest

`resources/skins.json` ships empty. Each entry describes one skin:

```json
{
  "version": 1,
  "skins": [
    {
      "dir": "example",
      "package": "@acme/dsh-client-ui-skin-example",
      "skinId": "ui-skin-example",
      "name": "Example",
      "bodyAttr": "data-dsh-example",
      "bodyVars": {},
      "cssFile": "example.css",
      "cssKB": 24,
      "accent": "#4a5fa8"
    }
  ]
}
```

`cssFile` is resolved relative to `resources/`. The CSS should be scoped under the body attribute
(`body[data-dsh-example]`) and may embed images as data URIs.

## Install

Place the directory under a collection root, for example `%PLUGIN_ROOT%\skins\skin-manager\`, then:

```powershell
dsh plugin --profile <profile> add "link:<path-to-this-directory>"
```

Skin packages themselves are separate plugins. Install and register them according to the collection layout in
`docs/en/01-hierarchy.md`. The manager only toggles their rows.

## Notes

- The repository ships no skin packages or CSS; the empty manifest makes the manager start with an empty list.
- UI strings are Chinese; adapt `lib/client.js` or route them through a locale service.
- The manager never manages itself or host-critical rows.
- Changes take effect through patch hot reload; open pages need a refresh.

## Files

| File | Purpose |
|---|---|
| `package.json` | bundle manifest (`dsh.bundle.patch`, `dsh.client`) |
| `cordis.patch.yml` | mounts the manager itself |
| `lib/index.js` | host half: manifest, state, CSS route, managed-block writes |
| `lib/client.js` | browser half: settings section, single-select UI, style injection |
| `resources/skins.json` | skin manifest (empty by default) |
| `templates/home.cordis.patch.yml` | skeleton for a missing home-layer patch |

## 中文

DSH 皮肤管理器的参考实现：皮肤作为资源处理，不注册为插件。管理器读取 `resources/skins.json`，
按需提供 CSS，并通过 home 层托管区块实现单选。仓库内清单为空，因此默认不显示任何皮肤；
按清单格式补条目与 CSS 后即可使用。UI 文案为中文，可按需修改。
