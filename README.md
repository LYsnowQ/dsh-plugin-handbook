# DSH 插件管理规范（分享版）

> 一份可以直接转发的 **DSH（DeepSeek Harness）插件管理规范**：
> 只讲「插件怎么放、怎么装、怎么启停、怎么升级」，不含任何具体业务插件的实现、配置或沿革。

---

## 0. 这份资料是什么

| 是 | 不是 |
|---|---|
| 本地插件源码仓库的**目录层级规范** | DSH 官方文档的替代品 |
| 插件包的**最小契约**（`package.json` / patch / 两半边） | 某个具体插件的使用说明 |
| 安装、校验、升级、回滚、卸载的**标准流程** | 插件市场或账号配置教程 |
| 补丁层的**优先级与权重分配规则** | 万能的「改配置」技巧合集 |
| 自建「插件管理器」的**准入条件与安全红线** | 可直接发布的成品管理器代码 |

适用范围：DSH 的 bundle / plugin 模型（Cordis Loader 的 patch 组合）。
DSH 版本升级后若行为有变，以实际 `dsh` 行为为准，本文档应随之修订。

---

## 1. 先记住五条不变量

1. **一个插件一个顶层文件夹**，文件夹名 = 插件包名（`package.json` 的 `name`；
   带作用域的包见 `01` §2）。结构上只有两类例外：**合集**（同形态插件收在一起）与
   **管理层**（管理器自己）。
2. **包根 = 含 `package.json` 的那个版本层**；注册给 DSH 的路径**永远**是
   `<插件>\current` 这个目录联接，不直接注册版本号目录。
3. **版本目录是只读快照**。要改就发新版本；万不得已就地改，必须留
   `LOCAL-PATCH.md` 说明改了什么、为什么。
4. **启停只有一种表达：patch 里的 `disabled`**。没有「删除条目」语法；
   管理器只能写自己命名空间下的托管区块。
5. **层越靠后越说了算**：bundle → profile → home → `--patch`。
   自建管理器写 **home 层**，因此能压过 profile 层。

---

## 2. 本资料的目录

```text
DSH\
├── README.md                    ← 本文件：导览、目录树、术语、五分钟上手
├── AGENTS.md                    ← 给智能体的入口：首次使用先读第 8 节
├── LICENSE
├── 01-层级规范.md                ← 目录怎么分层、怎么命名、current 联接、合集、管理层
├── 02-插件包契约.md              ← package.json / cordis.patch.yml / 宿主半边 / 浏览器半边
├── 03-安装升级与卸载.md          ← dsh plugin 流程、校验、升级回滚、生效方式、快照纪律
├── 04-补丁层与优先级.md          ← 补丁层、权重分配、语法、托管区块、开放边界
├── 05-管理器规范.md              ← 管理器的形态、硬性要求、命名空间、安全红线
├── 06-编码与文档约定.md          ← 编码/换行、命名、文档分工、关联强度、卫生习惯
├── 07-检查清单与排错.md          ← 新增/升级/回滚/卸载清单、排错表、命令速查
└── 模板\                        ← 可以直接复制的模板与新建脚本
    ├── README.md
    ├── package.host.json.template      # 宿主插件 package.json
    ├── package.client.json.template    # 浏览器 UI 插件 package.json
    ├── cordis.patch.yml                # 挂载声明
    ├── home.cordis.patch.yml           # home 层补丁 + 托管区块骨架
    └── new-plugin.ps1                  # 按规范生成插件骨架
```

**阅读路线**

- 第一次接手：`01` → `02` → `03`，然后照着 `07` 的清单做一遍。
- 只想改启停：`04`（层级与托管区块）→ `05`（管理器红线）。
- 出问题时：`07` 的排错表 → 再回到对应章节。
- 要交给 AI agent 执行：把 `01`、`02`、`07` 一起给它，规则最完整。

---

## 3. 插件仓库目录树（规范要求）

把插件源码仓库的根目录记为 `%PLUGIN_ROOT%`（示例：`D:\dsh-plugins`）。
它**不是** `$DSH_HOME`，也**不是**任何 profile 目录——DSH 不会自动扫描它，
必须用 `dsh plugin ... add` 注册后才会被加载。

```text
%PLUGIN_ROOT%\
├── README.md                       # 文件级导览：本仓库有什么、放哪、谁和谁强关联
├── PLUGINS.md                      # 规范总纲（可把本资料 01–07 合订成这一个文件）
│
├── <包名>\                          # ① 独立插件：顶层 = 包名
│   ├── current                     #    Junction → 当前版本（注册给 DSH 的唯一路径）
│   ├── <版本>\                      #    版本层 = 包根（package.json 必须在这一层）
│   │   ├── package.json            #    必需 dsh.bundle.patch；UI 插件另有 dsh.client
│   │   ├── cordis.patch.yml        #    挂载声明（只声明本插件自己）
│   │   ├── lib\
│   │   │   ├── index.js            #    宿主半边（没有宿主逻辑也要有空实现）
│   │   │   └── client.js           #    浏览器半边（UI 插件才需要，且必须已编译）
│   │   ├── assets\                 #    图片 / 音效 / 其他静态资源
│   │   ├── README.md               #    用法、可调项、沿革、该插件专属排错
│   │   └── FILES.md                #    文件级说明
│   └── <旧版本>\                    #    历史版本：保留，便于回滚与排障
│
├── <合集名>\                        # ② 合集（可选）：同形态插件收在一起，视为一个条目
│   ├── README.md                   #    合集清单 + 启停方式 + 许可证
│   ├── current                     #    合集级 Junction → 当前合集版本
│   └── <合集版本>\
│       ├── <插件目录A>\             #    每个子目录才是完整插件包（package.json 在这一层）
│       └── <插件目录B>\
│
└── <管理器>\                        # ③ 管理层（可选）：单层，不套版本目录
    ├── package.json
    ├── cordis.patch.yml
    ├── lib\
    │   ├── index.js                #    宿主半边：读资源 / 提供路由 / 写托管区块
    │   └── client.js               #    浏览器半边：设置页里的管理界面
    ├── resources\                  #    被管理的资源或登记表
    ├── README.md
    └── FILES.md
```

三条层级规则（详见 `01`）：

1. **第一层 = 插件包名**，不是中文名、不是仓库名、不带版本号。
2. **第二层 = 版本号**，取该版本 `package.json` 的 `version` 字段原样照抄
   （`0.3.7` 就是 `0.3.7`，不写 `v0.3.7`、不写 `latest`）。
3. **`package.json` 必须正好躺在版本层**，不要再往下多套一层同名目录。

---

## 4. 术语表

| 词 | 含义 |
|---|---|
| **DSH / Harness** | DeepSeek Harness，本规范针对的宿主程序 |
| **`$DSH_HOME`** | DSH 的数据根目录（默认 `~/.dsh`），下面有 `profiles\`、`cordis.patch.yml` 等 |
| **profile** | 一套可启动的组合：`$DSH_HOME\profiles\<name>\`（有自己的 `package.json`、patch、`node_modules`） |
| **bundle** | 一种特殊 npm 包：`package.json` 里声明 `dsh.bundle.patch`，加载时把自己的 patch 叠进组合树 |
| **插件行（row）** | patch 里的一个条目：`id` + `name`（模块名）+ 可选 `config` / `disabled` |
| **patch** | 一层 YAML 列表，按顺序叠加到组合树上；只有「改/插/禁用」，没有删除 |
| **托管区块（managed block）** | patch 文件里由某个管理器自动维护的一段，带固定起止标记，区块外内容不动 |
| **包根（package root）** | 含 `package.json` 的那一层；安装的是这一层 |
| **`current`** | 插件根下的目录联接，指向当前版本；注册路径永远经过它 |
| **宿主半边 / 浏览器半边** | 插件的 Node 侧代码（`lib\index.js`）与浏览器侧代码（`lib\client.js`） |
| **link: 安装** | `dsh plugin add "link:<绝对路径>"`：profile 里记一条 `link:` 依赖，改源码即改运行内容 |

### 命令里的约定

- 本文所有命令都用 `dsh`，指**与你安装方式匹配的 CLI**（桌面应用一般可从应用菜单安装/接管 `dsh` 命令）；
- `$env:DSH_HOME` 指 DSH 数据根目录，通常是 `$env:USERPROFILE\.dsh`；
  如果你的 shell 里没有这个环境变量，把所有命令里的 `$env:DSH_HOME` 换成
  `$env:USERPROFILE\.dsh` 即可；
- `<profile>` 是占位符，替换成你实际使用的 profile 名（例如 `web`、`desktop`、`tui`……）；
- 示例路径 `D:\dsh-plugins` 只是示意，换成你自己的插件仓库根目录。

---

## 5. 五分钟上手

```powershell
# 0) 约定：插件放在 %PLUGIN_ROOT%\<包名>\<版本>\，注册路径走 current
$root = "D:\dsh-plugins\example-plugin"

# 1) 把插件包放进版本层（package.json 必须在这一层）
#    %PLUGIN_ROOT%\example-plugin\1.0.0\package.json

# 2) 建 current 联接（指向当前版本，无需管理员权限）
New-Item -ItemType Junction -Path "$root\current" -Target "$root\1.0.0"

# 3) 注册（永远注册 current，不要注册 1.0.0）
dsh plugin --profile <profile> add "link:$root\current"

# 4) 校验：profile 记录 + 软链目标 + 组合树
Get-Content "$env:DSH_HOME\profiles\<profile>\package.json"
Get-ChildItem "$env:DSH_HOME\profiles\<profile>\node_modules" -Force |
  Where-Object Name -eq 'example-plugin' | Select-Object Name, LinkType, Target
dsh --profile <profile> --dump-config | Select-String 'example-plugin'

# 5) 生效：宿主侧改动重启宿主；纯浏览器改动硬刷新页面（Ctrl+F5）
```

升级只多两步：把新版本放进 `<版本B>\`，把 `current` 重新指过去，再重启。
回滚就是把 `current` 指回旧版本。**卸载不会删文件**，只解注册。

---

## 6. 三条最常见的误解

| 误解 | 事实 |
|---|---|
| 「`dsh plugin add` 之后插件会自动被扫描到」 | 不会。必须先注册；注册后才写进 profile 的 `dependencies` 与 `dsh.profile.bundles` |
| 「把插件文件夹挪个位置没关系，反正有软链」 | 有关系。注册的是**绝对路径**；移动 `%PLUGIN_ROOT%` 或插件文件夹会让所有 `link:` 失效 |
| 「不想要就 `remove`，切换开关也 `remove`」 | `remove` 会摘掉依赖与 bundle 条目；日常启停用 patch 的 `disabled`，不要用 `remove` |

---

## 7. 使用建议

- 把本资料放在插件仓库的**同级**或仓库根的 `docs\` 下，和 `PLUGINS.md` 一起维护；
  要放进仓库时，可以把 `01`–`07` 按顺序合并成 `PLUGINS.md`（保留章节编号），
  `模板\` 单独保留。
- 改动规范时，先改 `01`–`05` 的规则正文，再同步 `07` 的清单与 `模板\`，
  避免「文档一套、模板一套」。
- 单个插件的用法、开关、变更记录写在**该插件自己的 README**，不要塞回本资料。

---

## 8. 首次使用：请智能体先问用户（重要）

> **把本仓库交给智能体时，请让它先读这一节。**
> 在用户回答完下面三个问题之前，**不要删除、移动或重新注册任何插件**。

如果你是智能体，且这是你第一次在这个环境里处理 DSH 插件，请先向用户确认：

### ① 是否把所有插件整理到本规范的管理之下？

问法示例：

> 「我发现这个环境里有 N 个 DSH 插件。要不要我按《DSH 插件管理规范》把它们统一整理到同一个插件仓库，并登记到管理器中？整理只调整目录与注册方式，不删插件代码。」

- 用户**同意**：按 `01`–`03` 先盘点 → 规划目录 → 迁移 → 逐个重新注册 → 校验；
- 用户**不同意或不确定**：只做**只读盘点**（列出插件、版本、注册路径、所属 profile），
  不要改任何文件。

### ② 插件源码目录放在哪里（`%PLUGIN_ROOT%`）？

必须由用户指定；用户没指定就给出推荐并等确认。硬性建议：

- **不要**放在 DSH 安装目录、`$DSH_HOME`、`profiles\<name>\` 或任何 `node_modules` 里；
- **不要**和 DSH 应用同目录——升级、重装、清理时容易被整体删除；
- 推荐独立目录，例如 `D:\dsh-plugins`、`%USERPROFILE%\dsh-plugins`；
- 路径尽量不含空格和中文，避免脚本转义问题；
- 迁移已有插件会让原 `link:` 失效，必须逐个 `remove` 再 `add`（见 `03` §2）。

### ③ 当前使用哪个 profile？

`dsh plugin --profile <name> ...` 里的 `<name>` 必须向用户确认，**不要猜**。
桌面应用通常使用它自己的 profile；不同 profile 的插件互不影响，装错 profile 等于没装。

### 可直接粘贴给智能体的固定提示

> 先读 `README.md` 第 8 节与 `01`–`03`。
> 在得到我确认前：不要删除/移动插件，不要改 profile 的 `package.json` 或 patch，不要执行 `remove`。
> 然后问我三件事：①是否把所有插件整理到该规范下；②插件源码目录放哪（不要和 DSH 同目录）；
> ③用哪个 profile。我确认后，先给我一份只读盘点与迁移计划，再动手。

---

**给所有拉取本项目的用户：** 请让你的智能体在首次使用时先问你——是否要把所有插件整理到本规范的管理之下；并把插件源码目录（**不要和 DSH 同目录**，避免升级、重装或清理时被误删）和当前 profile 明确告诉它。它应当先给出只读盘点与迁移计划，再动手。
