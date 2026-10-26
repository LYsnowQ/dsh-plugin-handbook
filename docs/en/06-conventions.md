# 06 · Encoding and Documentation Conventions

## 1. Encoding and line endings

| Item | Rule |
|---|---|
| Encoding | UTF-8 without BOM |
| New file line endings | LF: Markdown, YAML, JS, JSON |
| Upstream files | keep as-is; do not convert CRLF |
| Bulk conversion | prohibited |

Exception: `.ps1` scripts targeting Windows PowerShell 5.1 use UTF-8 with BOM (5.1 reads BOM-less UTF-8 as ANSI).

## 2. JSON and YAML

- `package.json`: strict JSON, 2-space indentation (format script output uniformly), no comments, no trailing commas;
- key order: `name`, `version`, `private`, `type`, `description`, `main`/`exports`, `dsh`, `files`, `license`;
- `exports`: `.` is required; UI plugins add `./client`; add `./package.json`, `./locale/*.json`, `./icon` as needed;
  do not declare files that do not exist;
- patches: top-level array; quote strings containing `@`; do not write comments inside managed blocks;
  use block style for multi-line `config`.

```yaml
- id: my-notes
  name: '@acme/notes'
```

## 3. Naming

| Object | Rule | Example |
|---|---|---|
| Package name | lowercase, hyphens, optional scope | `dsh-notes`, `@acme/dsh-notes` |
| Top-level directory | same as package name; scoped packages per `01` | `dsh-notes\` |
| Version directory | matches `version` | `1.2.0\`, `0.2.0-rc.2\` |
| Row id | lowercase kebab, prefixed by domain | `ui-notes-panel`, `tool-notes` |
| Managed block id | manager package name | `my-plugin-manager` |
| Documentation | Chinese or English; plugin root or repo root | `README.md`, `FILES.md` |

Constraints:

- row ids are unique within a composition; changing an id creates a new entry;
- package name = browser module id = patch `name` = profile dependency name;
- UI text goes through locale; do not hardcode.

## 4. Documentation split

| Document | Contains | Excludes |
|---|---|---|
| Specification | layout, contract, lifecycle, patch layers, manager rules | individual plugin usage and history |
| Repository README | entry index, cross-plugin constraints, general troubleshooting | per-plugin changelog, implementation details |
| Plugin README | usage, options, history, plugin-specific troubleshooting | other plugins |
| Plugin FILES.md | file-level description, strong/weak links | usage tutorial |

Plugin-specific content must not enter the specification.

## 5. Link strength

| Term | Meaning | Effect of a wrong change |
|---|---|---|
| Strong | paths/names/fields must match exactly | failure or error |
| Weak | convention or default | degraded but not fatal |
| None | independent | free to move/delete |

## 6. Change records

- per-plugin history goes in the plugin `README.md` or `CHANGELOG.md`;
- specification changes update the specification and synchronize checklists and templates;
- local fixes for upstream defects go in `LOCAL-PATCH.md`.

## 7. Hygiene

- do not commit `node_modules\`, build caches, temporary files, or logs;
- do not commit credentials, tokens, or signed URLs;
- retain third-party `LICENSE`, `NOTICE`, `PROVENANCE.md`;
- `lib\client.js` is a build artifact and must be committed;
- do not commit the `current` junction (Git may traverse it as a directory);
- inline or externalize large files.
