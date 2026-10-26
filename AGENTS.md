# AGENTS.md

This repository contains the bilingual DSH plugin-management specification plus two reference manager bundles:

- `plugin-manager/` — `dsh-plugin-manager`
- `skins/skin-manager/` — `dsh-skin-manager`

It is not a single installable plugin package. The managers are separate bundles; each can be registered with
`dsh plugin add "link:<path>"`.

On first use in an environment:

1. Read `README.md`, `docs/en/README.md` (or `docs/zh/README.md`), chapters `01`–`03` and `07`.
2. Perform a read-only inventory: installed plugins, versions, registration paths, profile, patch layers.
3. Confirm with the user:
   - whether to bring existing plugins under this specification;
   - the `%PLUGIN_ROOT%` location. Prohibited: the DSH installation directory, `$DSH_HOME`, `profiles\<name>\`,
     `node_modules`; do not use the same directory as the DSH application. Use a standalone directory.
   - the target profile.
4. Produce a migration plan (directory changes, `link:` re-registration, rollback method) and wait for approval.
5. Before approval, do not: delete or move plugins, modify the profile `package.json` or patches, or run `remove`.
6. Reconfirm before any operation that changes registration or deletes files.

Reference managers:

- `plugin-manager/resources/registry.json` and `skins/skin-manager/resources/skins.json` are empty by default.
- No third-party plugins, skins, or skin CSS are bundled.
- UI strings are Chinese; adapt them if required.

## 中文

本仓库包含 DSH 插件管理规范的中英双语文档，以及两个管理器参考实现：
`plugin-manager/`（`dsh-plugin-manager`）与 `skins/skin-manager/`（`dsh-skin-manager`）。
它们各自是独立 bundle，需分别注册；仓库本身不是单个可安装插件。

首次接入某环境时：

1. 读取 `README.md` 与 `docs/zh/README.md`（或 `docs/en/README.md`），以及 `01`–`03`、`07`。
2. 只读盘点：插件清单、版本、注册路径、profile、patch 层现状。
3. 向用户确认：是否纳入本规范；`%PLUGIN_ROOT%` 位置（禁止 DSH 安装目录、`$DSH_HOME`、`profiles\<name>\`、
   `node_modules`、与 DSH 应用同目录）；目标 profile。
4. 输出迁移计划（目录调整、`link:` 重注册、回滚方式），确认后执行。
5. 确认前禁止：删除/移动插件、修改 profile 的 `package.json` 或 patch、执行 `remove`。
6. 任何改变注册关系或删除文件的操作，执行前再次确认。
