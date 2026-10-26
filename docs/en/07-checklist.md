# 07 · Checklists and Troubleshooting

## 1. New plugin

- [ ] Choose the form: standalone / collection / management layer (`01` §1)
- [ ] Create `%PLUGIN_ROOT%\<package-name>\<version>\`
- [ ] `package.json` at the version layer with `name`, `version`, `type`, `exports`, `dsh.bundle.patch`;
      UI plugins also need `dsh.client` and `exports["./client"]`
- [ ] `cordis.patch.yml` inserts this plugin only; row `id` and `name` are correct
- [ ] `lib\index.js` exists and exports `apply`
- [ ] UI plugin `lib\client.js` is built and `load({ id })` equals the package name
- [ ] Create the `current` junction
- [ ] `dsh plugin --profile <profile> add "link:<plugin-root>\current"`
- [ ] Three-layer verification: profile record, symlink target, `# == <package-name>` in `--dump-config`
- [ ] Restart the host or hard-refresh the page; verify behavior
- [ ] Add `README.md` and `FILES.md`
- [ ] Register the entry in the repository README

## 2. Release a new version

- [ ] Copy or build into `<new-version>\`; keep the old version
- [ ] Update `version` to match the directory name
- [ ] Check that overridden `config` fields are complete (whole-block replacement)
- [ ] Exclude `node_modules`, temporary files, and `current`
- [ ] Repoint `current`
- [ ] Restart the host and run the three-layer verification
- [ ] Record changes and migration notes
- [ ] Keep at least one rollback version

## 3. Rollback

- [ ] Confirm the target version directory exists
- [ ] Remove the `current` junction (no trailing backslash, no `-Recurse`)
- [ ] Recreate the junction to the old version
- [ ] Restart the host
- [ ] Run the three-layer verification
- [ ] Confirm config/data compatibility
- [ ] Record the rollback reason

## 4. Uninstall

- [ ] `dsh plugin --profile <profile> remove <package-name>`
- [ ] Confirm removal from `dependencies` and `dsh.profile.bundles`
- [ ] Remove stale rows from the home-layer managed block
- [ ] Remove the `current` junction, then the plugin directory
- [ ] Update the repository README
- [ ] Back up plugin state files if needed

## 5. Manager changes

- [ ] Single layer, both halves present
- [ ] Writes only its own managed block; nothing outside it
- [ ] Operates only in its namespace; rejects official packages and critical rows
- [ ] Resolves actual row ids before writing
- [ ] Atomic and idempotent writes
- [ ] Unknown/forbidden ids return errors
- [ ] Prompts for refresh after switching
- [ ] README documents the boundary with the host built-in manager
- [ ] `--dump-config` shows only this manager's layer changing the target row

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `add` succeeds but no row in composition | missing `dsh.bundle.patch`, wrong patch path, wrong profile | fix and re-`add` |
| symlink target points to a version directory | wrong registration path | `remove`, then re-`add` with `current` |
| no plugin in settings | host-only, missing `exports["./client"]`, host not restarted | add both halves, restart |
| `loaded without registering` | `load({ id })` ≠ package name, factory does not return `apply` | unify id, fix factory |
| `declares dsh.client but exports no "./client" bundle` | `dsh.client` and `exports` disagree | add `"./client"` |
| `import failed` / host startup fails | host entry error; half-written save | fix entry; atomic publish; restart |
| `Cannot find module 'x'` | non-baseline module not inlined/declared | inline or `dsh.client.external` |
| `patch: entry "<id>" not found` | managed block/manual patch references a missing row | delete the row or rewrite the block |
| `patch: name mismatch ... skipping` | patch `name` differs from package name | use package name; quote `@` |
| toggle has no effect | higher patch layer overrides; two control planes; memory-only change | inspect `patched by`; keep one control plane |
| code change has no effect | wrong half or no refresh/restart | restart for host; Ctrl+F5 for browser |
| version change has no effect | `current` not repointed, host not restarted, browser cache | repoint + restart + hard refresh |
| `--dump-config` rejected | profile owned by the host | shadow profile (`03` §3) |
| everything breaks after moving the repo | `link:` records absolute paths | `remove` / `add` each; do not move the root |
| target directory lost after deleting `current` | trailing backslash or `-Recurse` used | restore from backup; use the safe form |
| manager settings page missing | not registered, not restarted, browser half missing | check `dsh.client` / `exports["./client"]`, restart |

## 7. Commands

```powershell
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"
Get-ChildItem "$env:DSH_HOME\profiles\<profile>\node_modules" -Force |
  Where-Object Name -eq '<package-name>' | Select-Object Name, LinkType, Target
dsh plugin --profile <profile> why <package-name>
dsh --profile <profile> --dump-config
dsh --profile <profile> --dump-default-config
dsh --profile <profile> --dump-config-schema
dsh --profile <profile> --patch .\extra.yml --dump-config
Test-Path "<plugin-root>\current"
(Get-Item "<plugin-root>\current").Target
```
