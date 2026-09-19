# 将关卡文件中的地图行统一补齐到 20 列（只补齐“纯地图字符”行）
$dir = 'C:\Users\Asus\.zcode\workspace\default\bounce-valley\js\levels'
foreach ($f in @('level1.js', 'level2.js', 'level3.js')) {
    $p = Join-Path $dir $f
    $lines = Get-Content $p -Encoding UTF8
    $fixed = 0
    $out = foreach ($l in $lines) {
        if ($l.Length -gt 0 -and $l.Length -lt 20 -and $l -match "^[.#=/\\^oCEBWPs'iXMmrLhD]+$") {
            $fixed++
            $l.PadRight(20, '.')
        }
        else { $l }
    }
    Set-Content -Path $p -Value $out -Encoding UTF8
    Write-Host "$f : padded $fixed rows"
}
