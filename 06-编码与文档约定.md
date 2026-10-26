# 06 · 编码与文档约定

## 1. 编码与换行

| 项 | 约定 |
|---|---|
| 编码 | UTF-8，无 BOM |
| 新建文件换行 | LF：Markdown、YAML、JS、JSON |
| 上游文件 | 保持原样，不转换 CRLF |
| 批量转换 | 禁止 |

例外：需兼容 Windows PowerShell 5.1 的 `.ps1` 使用 UTF-8 BOM（5.1 将无 BOM 的 UTF-8 当作 ANSI）。

## 2. JSON / YAML

- `package.json`：严格 JSON，2 空格缩进（脚本输出统一格式化），无注释、无尾逗号；
- 键顺序：`name`、`version`、`private`、`type`、`description`、`main`/`exports`、`dsh`、`files`、`license`；
- `exports`：`.` 必须有；UI 插件加 `./client`；按需加 `./package.json`、`./locale/*.json`、`./icon`；不声明不存在的文件；
- patch：顶层数组；含 `@` 的字符串加引号；注释不写入托管区块；多行 `config` 用块状写法。

```yaml
- id: my-notes
  name: '@acme/notes'
```

## 3. 命名

| 对象 | 规则 | 例 |
|---|---|---|
| 包名 | 小写、连字符，可用作用域 | `dsh-notes`、`@acme/dsh-notes` |
| 顶层目录 | 同包名；作用域包见 `01` | `dsh-notes\` |
| 版本目录 | 与 `version` 一致 | `1.2.0\`、`0.2.0-rc.2\` |
| 行 id | 小写 kebab，按领域加前缀 | `ui-notes-panel`、`tool-notes` |
| 托管区块标识 | 管理器包名 | `my-plugin-manager` |
| 文档 | 中文可用，置于插件根或仓库根 | `README.md`、`FILES.md` |

约束：

- 行 id 在组合内唯一；改 id 视为新增条目；
- 包名 = 浏览器模块 id = patch `name` = profile 依赖名；
- 界面文案走 locale，不硬编码。

## 4. 文档分工

| 文档 | 内容 | 不写 |
|---|---|---|
| 规范总纲 | 目录、契约、生命周期、patch 层、管理器规则 | 单个插件用法与沿革 |
| 仓库 README | 条目导览、跨插件约束、通用排错 | 单插件变更记录、实现细节 |
| 插件 README | 用法、可调项、沿革、专属排错 | 其他插件 |
| 插件 FILES.md | 文件级说明、强/弱关联 | 使用教程 |

单插件相关内容不进入规范总纲。

## 5. 关联强度

| 词 | 含义 | 改错影响 |
|---|---|---|
| 强关联 | 路径/名称/字段逐字匹配 | 功能失效或报错 |
| 弱关联 | 约定或默认值 | 退化但不致命 |
| 无关联 | 互不影响 | 可任意移动/删除 |

## 6. 变更记录

- 单插件沿革写入该插件 `README.md` 或 `CHANGELOG.md`；
- 规范变更改总纲，并同步检查清单与模板；
- 上游缺陷的本地修补写入 `LOCAL-PATCH.md`。

## 7. 卫生

- 不提交 `node_modules\`、构建缓存、临时文件、日志；
- 不提交凭据、token、带签名的 URL；
- 保留第三方 `LICENSE`、`NOTICE`、`PROVENANCE.md`；
- `lib\client.js` 为编译产物，必须提交；
- 不提交 `current` 联接（Git 可能将其作为目录遍历）；
- 大文件内联压缩或外置。
