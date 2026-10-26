# AGENTS.md

本仓库为 DSH 插件管理规范，不是可安装的插件包。

首次接入某环境时：

1. 读取 `README.md` 的「首次接入」及 `01`–`03`、`07`。
2. 只读盘点：插件清单、版本、注册路径、所属 profile、patch 层现状。
3. 向用户确认：
   - 是否将现有插件纳入本规范；
   - `%PLUGIN_ROOT%` 位置：禁止 DSH 安装目录、`$DSH_HOME`、`profiles\<name>\`、`node_modules`；
     禁止与 DSH 应用同目录；推荐独立目录；
   - 目标 profile。
4. 输出迁移计划（目录调整、`link:` 重注册、回滚方式），确认后执行。
5. 用户确认前禁止：删除/移动插件、修改 profile 的 `package.json` 或 patch、执行 `remove`。
6. 任何改变注册关系或删除文件的操作，执行前再次确认。
