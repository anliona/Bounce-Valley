# 打包项目为可上传 GitHub 的 ZIP（解压后即为完整项目，含顶层目录 bounce-valley/）
$src = 'C:\Users\Asus\.zcode\workspace\default\bounce-valley'
$stageRoot = Join-Path $env:TEMP 'bv-pkg'
$staging = Join-Path $stageRoot 'bounce-valley'
$zipTemp = Join-Path $env:TEMP 'bounce-valley.zip'
$zipFinal = Join-Path $src 'bounce-valley.zip'

# 1. 准备干净暂存目录
Remove-Item $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging -Force | Out-Null

# 2. 复制项目（排除旧的 zip 自身）
robocopy $src $staging /E /XF bounce-valley.zip /NFL /NDL /NJH /NJS | Out-Null

# 3. 压缩
if (Test-Path $zipTemp) { Remove-Item $zipTemp -Force }
Compress-Archive -Path $staging -DestinationPath $zipTemp -Force

# 4. 放回项目目录（供本地服务器提供下载）
Copy-Item $zipTemp $zipFinal -Force
Remove-Item $stageRoot -Recurse -Force -ErrorAction SilentlyContinue

$kb = [Math]::Round((Get-Item $zipFinal).Length / 1KB)
Write-Host "OK: $zipFinal ($kb KB)"
