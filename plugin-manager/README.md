# dsh-plugin-manager

Reference implementation of a plugin manager for DSH. It adds a **My Plugins** section to the host
settings page and toggles third-party bundles through the home-layer managed block.

## Behavior

- Scans the active profile's `node_modules` for packages declaring `dsh.bundle.patch`.
- Excludes `@deepseek-ai/*` and skin packages (`dsh-client-ui-skin-*`); skins belong to `skin-manager`.
- Writes enable/disable state to `$DSH_HOME/cordis.patch.yml` inside:

```yaml
# >>> dsh-plugin-manager:managed >>>
- id: my-plugin
  disabled: true
# <<< dsh-plugin-manager:managed <<<
```

- Content outside the block is preserved.
- `resources/registry.json` records which plugins are managed; the repository ships it empty.
- Profile directory is resolved from the Loader root include, then `DSH_PROFILE`.

## Install

```powershell
dsh plugin --profile <profile> add "link:<path-to-this-directory>"
```

Restart the host after installation. The settings entry appears after the host loads the plugin.

## Requirements

- DSH build exposing the `settings.section` slot and route registration through `ctx.webServer`.
- `DSH_PROFILE` set when the profile directory cannot be derived from the Loader include path.

## Notes

- UI strings are Chinese; adapt `lib/client.js` or route them through a locale service.
- The manager never manages itself, `@deepseek-ai/*` packages, or host-critical rows.
- Changes take effect through DSH patch hot reload; open pages need a refresh.

## Files

| File | Purpose |
|---|---|
| `package.json` | bundle manifest (`dsh.bundle.patch`, `dsh.client`) |
| `cordis.patch.yml` | mounts the manager itself |
| `lib/index.js` | host half: discovery, state, managed-block writes, routes |
| `lib/client.js` | browser half: settings section and switches |
| `resources/registry.json` | managed-plugin registry (empty by default) |
| `templates/home.cordis.patch.yml` | skeleton for a missing home-layer patch |

## 中文

DSH 插件管理器的参考实现：在设置页增加「我的插件」，扫描当前 profile 的第三方 bundle，
通过 home 层托管区块启停。排除 `@deepseek-ai/*` 与皮肤包；仓库内 `registry.json` 为空，
首次启用某插件时由管理器登记。安装后需重启宿主，UI 文案为中文，可按需修改。
