# 01 · 目录层级

## 1. 三种形态

| 形态 | 顶层目录 | 版本层 | 注册单位 |
|---|---|---|---|
| 独立插件 | `<包名>\` | `<包名>\<版本>\` | 一个 bundle |
| 合集 | `<合集名>\` | `<合集名>\<合集版本>\<子目录>\` | 每个子目录一个 bundle |
| 管理层 | `<管理器>\` | 无（单层） | 一个 bundle |

顶层目录即条目。合集在仓库中算一个条目，注册时按子目录展开为 N 个 bundle。

## 2. 独立插件

```text
<包名>\
├── current             # Junction → 当前版本；注册路径只走这里
├── <版本>\              # 版本层 = 包根
│   └── package.json
└── <旧版本>\
```

规则：

1. 第一层目录名 = `package.json` 的 `name`，逐字一致，不带版本号。
   - 作用域包（`@scope/name`）不能直接作为目录名：用去 scope 的 `name`，或 `<scope>-<name>`，
     并在该插件 README 顶部登记「目录名 ↔ 包名」。
2. 第二层目录名 = `version` 字段原样照抄（`0.3.7`、`0.2.0-rc.2`）；
   不写 `v` 前缀、`latest`、日期。
3. `package.json` 必须正好在版本层。多套一层同名目录时注册路径内无 `package.json`，不会被当作包加载。
4. 插件根（`<包名>\` 本身）不得放 `package.json`。

## 3. `current` 联接

`dsh plugin add "link:<path>"` 记录绝对路径；路径注册后不得移动或改名。
注册目标固定为 `<插件>\current`，版本切换只改联接。

创建：

```powershell
$root = "D:\dsh-plugins\my-notes"
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.2.0"
```

升级 / 回滚：

```powershell
# 升级
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.3.0"

# 回滚
Remove-Item "$root\current" -Force
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.2.0"
```

删除联接：

```powershell
Remove-Item "$root\current" -Force        # 不带尾随反斜杠，不带 -Recurse
```

带尾随反斜杠或 `-Recurse` 可能穿透联接删除目标内容。

禁止：

- 注册 `...\my-notes\1.2.0`；
- 将 `current` 放入版本目录；
- 注册后移动/改名插件根或 `%PLUGIN_ROOT%`；
- 复制整个插件根（会连同联接一起复制）。

## 4. 合集

适用：同形态、数量多、需要成组管理的插件（主题、语言包、预设）。

```text
<合集名>\
├── README.md               # 清单、来源、启停方式、许可证
├── current -> <合集版本>\
└── <合集版本>\
    ├── <子目录A>\
    │   ├── package.json
    │   ├── cordis.patch.yml
    │   └── lib\
    └── <子目录B>\
```

规则：

1. 合集根不得有 `package.json`。
2. 合集版本层取批次共同版本；个别插件版本不同时以其包内 `version` 为准，并在合集 README 记录。
3. 子目录名用英文短名，与该插件自身标识一致。
4. 仅合集级 `current`，子插件不单独建 `current`。
5. 注册路径逐个列出：

   ```powershell
   dsh plugin --profile <profile> add `
     "link:D:\dsh-plugins\<合集名>\current\<子目录A>" `
     "link:D:\dsh-plugins\<合集名>\current\<子目录B>"
   ```

6. 同时启用多套通常不报错，但会争抢同一资源/视觉位；合集通常为单选，由管理器写 home 层托管区块。
   切换不要用 `dsh plugin remove`。

## 5. 管理层

```text
<管理器>\
├── package.json            # dsh.bundle.patch + dsh.client
├── cordis.patch.yml        # 仅插入管理器自身
├── lib\
│   ├── index.js
│   └── client.js
├── resources\              # 可选：登记表、资源
├── README.md
└── FILES.md
```

规则：

1. 单层结构：顶层即包根，无版本目录、无 `current`。
2. 目录名等于包名；按职责命名时，README 首段登记「目录名 ↔ 包名」。
3. 包名不得与宿主自带官方包重名。
4. `cordis.patch.yml` 只声明管理器自身；被管插件走 home 层托管区块。
5. 管理器不得管理自身，不得禁用其运行所依赖的行。

合集内的管理器同样单层，位于合集根（`<合集名>\<管理器>\`）或合集版本层
（`<合集版本>\<管理器>\`）；这是合集与管理层唯一叠加形式。

## 6. 版本目录快照

版本目录视为不可变。变更方式：

1. 新版本目录 + 重指 `current`（默认）；
2. 就地修改时，同层放 `LOCAL-PATCH.md`，记录：修改文件与段落、原因、升级上游后的重做方法、是否已反馈上游。

`link:` 安装直接读取源码目录。就地保存可能被宿主读到半文件，触发 `import failed`。写入使用临时文件 + rename：

```powershell
$tmp = "$target.new"
# 写入完整内容到 $tmp
Move-Item -Path $tmp -Destination $target -Force
```

## 7. 反例

| 反例 | 后果 |
|---|---|
| 顶层用中文名或仓库名 | 与包名不一致，升级/排障无法定位 |
| 版本目录再套同名目录 | 注册路径内无 `package.json`，不加载 |
| 插件根放 `package.json` | 根目录被误认为包根 |
| 把 `current` 纳入备份/压缩包 | 恢复后联接失效或变成普通目录 |
| 注册版本路径 | 升级后仍加载旧版本 |
| 移动 `%PLUGIN_ROOT%` | 所有 `link:` 失效，需逐个重注册 |
| `remove` 当启停开关 | 依赖与 bundle 条目被摘除 |
| 版本层含 `node_modules`、`.git` | 快照污染、体积膨胀 |

## 8. 仓库元数据

不进入版本层：`.github\`、`.git\`、`.gitignore`、`.gitattributes`、CI 配置、issue/PR 模板。

进入版本层：`package.json`、`cordis.patch.yml`、`lib\`、`assets\`、`locale\`、`README.md`、
`LICENSE`、`NOTICE`、`PROVENANCE.md`。第三方 `LICENSE` / `NOTICE` 不得删除。
