<#
.SYNOPSIS
  按 DSH 插件目录规范生成一个插件骨架（版本分层 + current 联接）。

.DESCRIPTION
  生成：
    <Root>\<Name>\
      current -> <Version>          （Junction）
      <Version>\package.json
      <Version>\cordis.patch.yml
      <Version>\lib\index.js
      <Version>\README.md
      <Version>\FILES.md
      <Version>\lib\client.js       （仅 -UI）

  只生成文件与联接，不自动注册；结束时会打印注册与校验命令。

.PARAMETER Name
  插件包名（package.json 的 name），同时作为顶层文件夹名。

.PARAMETER Version
  版本号，必须与目录名一致，例：1.0.0 / 0.2.0-rc.2

.PARAMETER Root
  插件仓库根目录，默认 <用户目录>\dsh-plugins。

.PARAMETER Description
  一句话说明，写进 package.json 与 README。

.PARAMETER RowId
  行 id（组合树里的本地 id），默认等于包名。合集/带前缀的插件可另行指定。

.PARAMETER UI
  同时生成浏览器半边（lib\client.js）并声明 dsh.client。

.EXAMPLE
  .\new-plugin.ps1 -Name my-notes -Version 1.0.0 -Description "本地笔记读写"

.EXAMPLE
  .\new-plugin.ps1 -Name @acme/dsh-notes-panel -Version 0.1.0 -UI -RowId ui-notes-panel
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Root = (Join-Path $env:USERPROFILE 'dsh-plugins'),
    [string]$Description = '',
    [string]$RowId = '',
    [switch]$UI
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}

# ---- 参数校验 --------------------------------------------------------------
if ($Name -notmatch '^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$') {
    throw "包名只能包含小写字母、数字、点、下划线、连字符（可带 @scope/ 前缀）：$Name"
}
if ($Version -notmatch '^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$') {
    throw "版本号请用三段式（可带预发布后缀）：$Version"
}
if ([string]::IsNullOrWhiteSpace($RowId)) { $RowId = $Name }
if ($RowId -notmatch '^[a-z0-9][a-z0-9._-]*$') {
    throw "行 id 只能包含小写字母、数字、点、下划线、连字符：$RowId"
}
if ([string]::IsNullOrWhiteSpace($Description)) { $Description = "$Name plugin" }

# 包名带作用域时，顶层文件夹用去掉作用域的 name（见 01 §2）
$folderName = $Name
if ($Name -match '^@[^/]+/(.+)$') { $folderName = $Matches[1] }

$pluginRoot = Join-Path $Root $folderName
$versionDir = Join-Path $pluginRoot $Version
$current    = Join-Path $pluginRoot 'current'

if (Test-Path $current) {
    throw "已存在 current 联接：$current。升级请手动重指，不要重建插件。"
}
if (Test-Path $versionDir) {
    throw "版本目录已存在：$versionDir。"
}

New-Item -ItemType Directory -Force -Path (Join-Path $versionDir 'lib') | Out-Null

# ---- package.json ----------------------------------------------------------
$exports = [ordered]@{
    '.'               = './lib/index.js'
}
if ($UI) { $exports['./client'] = './lib/client.js' }
$exports['./package.json'] = './package.json'

$pkg = [ordered]@{
    name        = $Name
    version     = $Version
    private     = $true
    type        = 'module'
    description = $Description
    main        = 'lib/index.js'
    exports     = $exports
    dsh         = [ordered]@{
        bundle = [ordered]@{ patch = './cordis.patch.yml' }
    }
    files       = @('lib', 'cordis.patch.yml', 'README.md', 'FILES.md')
    license     = 'MIT'
}
if ($UI) {
    $pkg.dsh['client'] = [ordered]@{
        platform    = 'web'
        immediately = $true
        inject      = @()
    }
}

$json = ($pkg | ConvertTo-Json -Depth 10) -replace "`r`n", "`n"
Write-Utf8 (Join-Path $versionDir 'package.json') ($json + "`n")

# ---- cordis.patch.yml ------------------------------------------------------
$patch = @"
# 挂载声明：只插入本插件自己这一行。
# 行 id 是组合树里的本地 id；name 必须是包名（含 @ 要加引号）。
- insert:
    - id: $RowId
      name: '$Name'
"@
Write-Utf8 (Join-Path $versionDir 'cordis.patch.yml') ($patch + "`n")

# ---- lib\index.js ----------------------------------------------------------
$hostCode = @"
export function apply() {
  // TODO: 在这里注册工具 / 路由 / 监听。
  // 用 ctx.effect(...) 或 ctx.on(...) 注册，并返回清理函数。
}
"@
Write-Utf8 (Join-Path $versionDir 'lib\index.js') ($hostCode + "`n")

# ---- lib\client.js（可选） --------------------------------------------------
if ($UI) {
    $client = @"
window.__ModuleLoader__.load({
  id: '$Name',
  factory(require) {
    const React = require('react')

    return {
      inject: ['slots'],
      apply(ctx) {
        // TODO: ctx.slots.inject(...) + ctx.slots.register(...)
        // 所有副作用都放在 apply 里，并返回清理函数。
      },
    }
  },
})
"@
    Write-Utf8 (Join-Path $versionDir 'lib\client.js') ($client + "`n")
}

# ---- README / FILES --------------------------------------------------------
$readme = @"
# $Name

$Description

## 安装

``````powershell
dsh plugin --profile <profile> add "link:$current"
``````

## 用法

（待补）

## 可调项

（待补）

## 排错

（待补）

## 沿革

（待补）
"@
Write-Utf8 (Join-Path $versionDir 'README.md') ($readme + "`n")

$files = @"
# $Name 文件导览

| 文件 / 目录 | 作用 | 位置要求 | 关联 |
|---|---|---|---|
| ``package.json`` | 包声明：name / version / exports / dsh | 包根 | 强关联 ``cordis.patch.yml``、``lib\`` |
| ``cordis.patch.yml`` | 挂载声明：插入本插件一行 | 包根 | 强关联 ``dsh.bundle.patch`` |
| ``lib\index.js`` | 宿主半边 | 与 ``exports["."]`` 对上 | 强关联包名 |
| ``lib\client.js`` | 浏览器半边（UI 插件） | 与 ``exports["./client"]`` 对上 | 强关联 ``dsh.client`` |
| ``README.md`` | 用法 / 可调项 / 沿革 | 包根 | 无关联运行时 |
| ``FILES.md`` | 本文件 | 包根 | 弱关联 ``README.md`` |

## 占位待补

- 可调项默认值；
- 依赖的服务/插槽；
- 专属排错。
"@
Write-Utf8 (Join-Path $versionDir 'FILES.md') ($files + "`n")

# ---- current 联接 ----------------------------------------------------------
New-Item -ItemType Junction -Path $current -Target $versionDir | Out-Null

# ---- 输出 ------------------------------------------------------------------
Write-Host ""
Write-Host "已生成：$versionDir" -ForegroundColor Green
Write-Host "current → $Version"
if ($Name -ne $folderName) {
    Write-Host "注意：包名带作用域，顶层文件夹用：$folderName（README 里记一下目录名 ↔ 包名）"
}
Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "  1) 补全 package.json / cordis.patch.yml / lib 代码"
Write-Host "  2) 注册：dsh plugin --profile <profile> add `"link:$current`""
Write-Host "  3) 校验：dsh --profile <profile> --dump-config | Select-String '$RowId'"
Write-Host "  4) 宿主侧改动重启宿主；浏览器侧改动硬刷新页面（Ctrl+F5）"
