# 下载 Git (便携版) 与 GitHub CLI 最新版
$ErrorActionPreference = 'Stop'
$tools = 'C:\Users\Asus\DevTools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null

# --- Git for Windows: PortableGit (免安装，解压即用，无需管理员) ---
$gitRel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'
$gitAsset = $gitRel.assets | Where-Object { $_.name -like 'PortableGit-*-64-bit.7z.exe' } | Select-Object -First 1
if (-not $gitAsset) { throw 'PortableGit asset not found' }
Write-Host ("Downloading " + $gitAsset.name + " ...")
& curl.exe -L --silent --show-error --retry 3 -o "$tools\PortableGit.7z.exe" $gitAsset.browser_download_url
if ($LASTEXITCODE -ne 0) { throw "curl failed for Git ($LASTEXITCODE)" }

# --- GitHub CLI: 独立 zip 构建 ---
$ghRel = Invoke-RestMethod 'https://api.github.com/repos/cli/cli/releases/latest'
$ghAsset = $ghRel.assets | Where-Object { $_.name -like 'gh_*_windows_amd64.zip' } | Select-Object -First 1
if (-not $ghAsset) { throw 'gh asset not found' }
Write-Host ("Downloading " + $ghAsset.name + " ...")
& curl.exe -L --silent --show-error --retry 3 -o "$tools\gh.zip" $ghAsset.browser_download_url
if ($LASTEXITCODE -ne 0) { throw "curl failed for gh ($LASTEXITCODE)" }

Get-Item "$tools\PortableGit.7z.exe", "$tools\gh.zip" | ForEach-Object {
    Write-Host ("OK  {0}  {1} KB" -f $_.Name, [Math]::Round($_.Length / 1KB))
}
