# 04 · Patch Layers and Priority

## 1. Composition

A profile root is an empty list; the tree is composed from patch layers:

```text
bundle layer     cordis.patch.yml of each bundle (in dsh.profile.bundles order)
profile layer    $DSH_HOME\profiles\<profile>\cordis.patch.yml
home layer       $DSH_HOME\cordis.patch.yml
overlay          --patch <file> (repeatable)
```

Later layers override earlier ones. When a row id is matched by multiple layers, the last layer that supplies
a field wins. `config` is replaced as a whole, not deep-merged.

The profile `cordis.yml` is maintained by DSH at startup; do not edit or depend on it.

## 2. Layer order

| Order | Layer | Path | Scope | Written by |
|---|---|---|---|---|
| 1 | bundle | `<bundle>\cordis.patch.yml` | this profile | plugin author |
| 2 | profile | `$DSH_HOME\profiles\<profile>\cordis.patch.yml` | this profile only | manual / host plugin manager |
| 3 | home | `$DSH_HOME\cordis.patch.yml` | all profiles | custom manager (managed block) + manual (outside blocks) |
| 4 | overlay | `--patch <path>` | this launch | temporary debugging |
| 5 | telemetry | synthesized from environment, not a file | this launch | `DSH_TELEMETRY_DISABLED` |

The 100/200/300/400/500 values used in this document only express this relative order; they are not DSH
configuration fields.

The home layer takes precedence over the profile layer: managers write the home layer, overriding equivalent
settings from the profile layer.

## 3. Allocation

| Requirement | Layer | Weight |
|---|---|---|
| Read-only query/display, no config writes | standalone plugin, no patch | — |
| Change one plugin's config for the current profile | profile layer | 200 |
| Enable/disable or configure across profiles | home layer, own managed block | 300 |
| Temporary override | `--patch` | 400 |
| One row managed by two managers | prohibited | — |

Admission requirements for a new manager:

1. Write only its own managed block; do not modify anything outside it.
2. Operate only on row ids in its own namespace; never disable official/kernel rows or host-critical rows (`05` §5).
3. Write atomically (temporary file + rename).
4. Do not gain priority by racing write order within one file; use a later layer for more authority.
5. Validate that target rows exist; reject unknown ids.

## 4. Syntax

The top level must be a YAML array.

Insert:

```yaml
- insert:
    - id: my-notes
      name: 'my-notes'
      config: {}
```

- an entry with `insert` appends rows;
- when `id` names a `group: true` row, rows are appended inside that group's `config` list;
- relative `name` paths are anchored beside the patch file.

Override:

```yaml
- id: my-notes
  name: 'my-notes'
  disabled: true
```

- `id` without `insert` targets an existing row;
- supplied fields replace the row's fields; `config` is replaced wholesale;
- `name` is an assertion: when truthy it must match the existing row's module name;
- no matching row, or a non-insert entry without a non-empty `id`: warn and skip; no row is created.

There is no delete syntax. A row disappears only when the layer introducing it is removed
(`dsh plugin remove`); otherwise it can only be `disabled: true`.

`disabled` values:

```yaml
- id: my-notes
  disabled: true
- id: other
  disabled: null
- id: env-only
  disabled: !!js process.platform !== 'win32'
```

- `!!js` is a Loader expression, not `!js`;
- `!!js` in row metadata is evaluated against the Loader context; in `config` it is evaluated after the
  plugin's injections activate, against the plugin context;
- `disabled` is persistent composition state, not a session toggle.

Row fields:

| Field | Description |
|---|---|
| `id` | local row id, unique within the composition |
| `name` | module/package name |
| `config` | configuration, replaced wholesale |
| `disabled` | boolean / null / `!!js` |
| `inject` | dependency injection |
| `intercept` | interception |
| `isolate` | service isolation, mapping to `true` or a realm label |
| `group` | with `group: true` + `name: cordis:group`, `config` is a nested row list |
| include row | with `name: cordis:include`, reads an external row list from `config.path` |

## 5. `name` assertion

If any row's `name` differs from the existing row:

```text
patch: name mismatch for "my-notes" (expected "my-notes", got "wrong-name"), skipping
```

The whole patch is skipped, not just that row. The layer does not appear in the `patched by` list and the
lower-layer state remains unchanged.

## 6. Row ids vs package names

- bundle patches use local row ids (`ui-theme-miku`, `tool-notes`);
- Loader runtime entry ids are path-qualified (`include:ui-theme-miku`).

| Context | Use |
|---|---|
| writing a patch | local id |
| reading runtime state / manager tool results | path-qualified id |
| writing `name` | package name (`@acme/dsh-theme-miku`) |

A manager must not assume `package name = row id`. It must parse the target bundle's patch and obtain the
actual row id and `name`.

## 7. Managed block

```yaml
# >>> my-plugin-manager:managed >>>
# my-plugin-manager: managed entries
- id: my-notes
  name: 'my-notes'
  disabled: false
- id: other-plugin
  disabled: true
# <<< my-plugin-manager:managed <<<
```

Rules:

1. The block is delimited by `# >>> <id>:managed >>>` and `# <<< <id>:managed <<<`; changing the id orphans
   the old block and requires migration.
2. Write inside the block only; manual entries, comments, and blocks of other tools outside it are preserved.
3. Every managed entry carries an explicit `disabled: true/false`; omission does not mean enabled.
4. Sort entries by row id; field order is `id` → `name` → `disabled`.
5. Atomic write: build the complete new file → temporary file → rename.
6. Enable with `disabled: false`; never delete the entry.

## 8. Extension boundaries

- Content outside the home-layer managed block is owned by the user or other tools; managers must not change it.
- `--patch` can override a manager's decision for temporary verification.
- Manually written profile-layer content overrides the bundle layer but is below the home layer.
- `disabled` is persistent; a profile-only disable belongs in the profile layer.

## 9. Anti-patterns

| Anti-pattern | Consequence |
|---|---|
| Two managers managing the same row id | Mutual overwrite; result depends on last write |
| Editing a managed block by hand | Lost on the next rewrite |
| Writing `disabled: false` in the profile layer against a home-layer disable | No effect |
| Using `remove` as a toggle | Dependencies and bundle entries are removed |
| Patching a nonexistent id | Startup warning; dirty block |
| Overriding `config` with only some fields | Remaining fields are cleared |
| Disabling `loader` / `include` / `hmr` or other critical rows | Composition breaks |
