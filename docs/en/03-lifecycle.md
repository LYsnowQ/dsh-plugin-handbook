# 03 · Install, Upgrade, Uninstall

## 1. Install

```powershell
# remove a same-name package from another path first
dsh plugin --profile <profile> remove <package-name>

# register current (absolute path)
dsh plugin --profile <profile> add "link:D:\dsh-plugins\<package-name>\current"

# multiple packages
dsh plugin --profile <profile> add "link:D:\dsh-plugins\a\current" "link:D:\dsh-plugins\b\current"
```

`dsh plugin --profile <name> <args...>` forwards the arguments to pnpm in the profile directory and, on success:

1. writes `"<package-name>": "link:<absolute-path>"` into profile `dependencies`;
2. appends the package name to `dsh.profile.bundles`;
3. creates the symlink in `node_modules`.

The first `dsh plugin` use initializes the profile (including `@deepseek-ai/dsh-base`). For a temporary profile
with a web UI, create it from the shipped template:

```powershell
dsh --profile <name> --from-default-profile web --dump-config
```

Prohibited: editing `package.json` / `dsh.profile.bundles` by hand; using relative paths; registering a
version directory.

## 2. Three-layer verification

```powershell
# 1) profile records
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"

# 2) symlink target should end with ...\<package-name>\current
Get-ChildItem "$env:DSH_HOME\profiles\<profile>\node_modules" -Force |
  Where-Object Name -eq '<package-name>' | Select-Object Name, LinkType, Target

# 3) composition should contain "# == <package-name>"
dsh --profile <profile> --dump-config | Select-String '<package-name>|not found|skipped'
```

Reading `--dump-config`:

- `# == <package-name>`: the bundle is in the composition;
- `patched by <path list>`: matching patch layers in application order;
- `disabled: true`: the row is disabled;
- `not found` / `skipped` / `name mismatch`: error indicators.

`--dump-default-config` prints the composition without user layers; `--dump-config-schema` prints the row schema.

## 3. Shadow profile

When the host owns the profile (startup and `--dump-config` rejected), verify against a temporary `DSH_HOME`:

```powershell
$vh = Join-Path $env:TEMP 'dsh-verify-home'
$pd = "$vh\profiles\check"
New-Item -ItemType Directory -Force -Path $pd | Out-Null

$m = Get-Content -Raw "$env:DSH_HOME\profiles\<profile>\package.json" | ConvertFrom-Json
$m.name = 'dsh-profile-check'
$json = $m | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText("$pd\package.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Copy-Item "$env:DSH_HOME\profiles\<profile>\cordis.patch.yml" "$pd\cordis.patch.yml" -ErrorAction SilentlyContinue

$env:DSH_HOME = $vh
dsh plugin --profile check install
dsh --profile check --dump-config | Select-String '<package-name>|not found|skipped'

Remove-Item -Recurse -Force $vh
```

- Do not use the name of a profile owned by the host.
- `package.json` must be UTF-8 without BOM; PowerShell 5.1 `-Encoding utf8` writes a BOM.
- `$env:DSH_HOME` is session-local.

## 4. Upgrade

```powershell
$root = "D:\dsh-plugins\my-notes"

# 1) place the new version in <root>\1.3.0\; keep the old version
# 2) repoint current
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.3.0"
# 3) restart the host
```

The registered path does not change; no re-`add` is required. Re-run the three-layer verification.

## 5. Rollback

```powershell
Remove-Item "D:\dsh-plugins\my-notes\current" -Force
New-Item -ItemType Junction -Path "D:\dsh-plugins\my-notes\current" -Target "D:\dsh-plugins\my-notes\1.2.0"
```

The old version is still present. Re-run verification after rollback.

## 6. Uninstall

```powershell
dsh plugin --profile <profile> remove <package-name>
```

This unregisters only; files are not deleted. Cleanup order:

```powershell
Remove-Item "D:\dsh-plugins\my-notes\current" -Force     # 1) remove junction
Remove-Item -Recurse -Force "D:\dsh-plugins\my-notes"    # 2) remove directory
```

A stale row id in the home-layer managed block produces `patch: entry "<id>" not found` at startup;
delete the row or let the manager rewrite the block.

## 7. Activation

| Change | Activation |
|---|---|
| `lib\client.js` / browser-side static assets | hard refresh (Ctrl+F5) |
| `lib\index.js` | restart the host |
| `package.json` / `cordis.patch.yml` / dependencies | restart the host |
| repoint `current` | restart the host |
| `disabled` in profile/home patch | hot reload of the composition; refresh the page |
| manager resource files | refresh the page; restart if the host caches them |

## 8. Atomic publish

`link:` installs read the version directory directly. In-place edits must use a temporary file + rename
to avoid the host reading a partially written file:

```powershell
$tmp = "$target.new"
# write complete content
Move-Item -Path $tmp -Destination $target -Force
```

Restart for host-half changes; hard refresh for browser-half changes. Record the change in `LOCAL-PATCH.md`.

## 9. Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `add` cannot find the path | relative path / wrong path / missing `current` | use absolute path; create the junction first |
| `add` succeeds but no row in composition | missing `dsh.bundle.patch` or patch file | fix and re-`add` |
| row is `skipped` | patch `name` differs from package name | fix `name` |
| symlink target points to a version directory | wrong registration path | `remove`, then re-`add` with `current` |
| old code after upgrade | `current` not repointed or host not restarted | repoint + restart |
| `import failed` | in-place save read half-written | atomic publish + restart |
| same-name package conflict | previously installed from another path | `remove` then `add` |

## 10. Commands

```powershell
dsh plugin --profile <profile> add "link:<plugin-root>\current"
dsh plugin --profile <profile> remove <package-name>
dsh plugin --profile <profile> why <package-name>
dsh plugin --profile <profile> install

dsh --profile <profile> --dump-config
dsh --profile <profile> --dump-default-config
dsh --profile <profile> --dump-config-schema
dsh --profile <profile> --patch .\extra.yml --dump-config
```
