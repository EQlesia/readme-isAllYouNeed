# health_check.ps1
# パスの存在確認スクリプト
# 使用方法: .\health_check.ps1

$dataJsonPath = "$PSScriptRoot\..\data\data.js"
$indexHtmlPath = "$PSScriptRoot\..\..\index.html"

Write-Host "=== 業務ナビゲーター ヘルスチェック ===" -ForegroundColor Cyan
Write-Host ""

# data.json 確認
if (Test-Path $dataJsonPath) {
    Write-Host "[OK] data.js が見つかりました: $dataJsonPath" -ForegroundColor Green
    try {
        $content = Get-Content $dataJsonPath -Raw
        # "window.GYOMU_DATA = [...];" から JSON部分を抽出してパース
        $jsonPart = $content -replace '^\s*window\.GYOMU_DATA\s*=\s*', '' -replace ';\s*$', ''
        $parsed = $jsonPart | ConvertFrom-Json
        Write-Host "     登録業務数: $($parsed.Count) 件" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] data.js の解析に失敗しました。ファイルが破損している可能性があります。" -ForegroundColor Yellow
    }
} else {
    Write-Host "[NG] data.js が見つかりません: $dataJsonPath" -ForegroundColor Red
}

# index.html 確認
if (Test-Path $indexHtmlPath) {
    Write-Host "[OK] index.html が見つかりました: $indexHtmlPath" -ForegroundColor Green
} else {
    Write-Host "[NG] index.html が見つかりません: $indexHtmlPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== チェック完了 ===" -ForegroundColor Cyan
Read-Host "Enterキーで終了"
