# 解压安装 Git + gh，写入用户 PATH 并验证
$ErrorActionPreference = 'Stop'
$tools = 'C:\Users\Asus\DevTools'
$gitDir = "$tools\Git"

# --- 1. 解压 PortableGit（7z 自解压包，静默模式） ---
if (Test-Path $gitDir) { Remove-Item $gitDir -Recurse -Force }
$proc = Start-Process -FilePath "$tools\PortableGit.7z.exe" `
    -ArgumentList "-o`"$gitDir`"", '-y' -Wait -PassThru -NoNewWindow
Write-Host ("PortableGit extract exit code: " + $proc.ExitCode)
if ($proc.ExitCode -ne 0) { throw "PortableGit extraction failed" }

# --- 2. 解压 gh ---
$ghDir = "$tools\gh"
if (Test-Path $ghDir) { Remove-Item $ghDir -Recurse -Force }
Expand-Archive "$tools\gh.zip" $ghDir -Force
$ghBin = Split-Path (Get-ChildItem $ghDir -Recurse -Filter gh.exe | Select-Object -First 1).FullName
Write-Host ("gh bin: " + $ghBin)

# --- 3. 写入用户 PATH（持久化） ---
$gitCmd = "$gitDir\cmd"
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
foreach ($p in @($gitCmd, $ghBin)) {
    if (($userPath -split ';') -notcontains $p) { $userPath = "$userPath;$p" }
}
[Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
Write-Host "User PATH updated."

# --- 4. 验证 ---
Write-Host ("git: " + (& "$gitCmd\git.exe" --version))
Write-Host ("gh:  " + (& "$ghBin\gh.exe" --version | Select-Object -First 1))
