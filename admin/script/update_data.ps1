# update_data.ps1
# ダウンロードフォルダに保存された data.js を所定の配置場所へ移動するスクリプト
# 使用方法: .\update_data.ps1

$destination = "$PSScriptRoot\..\data\data.js"
$downloadsFolder = [System.IO.Path]::Combine($env:USERPROFILE, "Downloads", "data.js")

Write-Host "=== data.js 更新スクリプト ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "コピー元: $downloadsFolder"
Write-Host "コピー先: $destination"
Write-Host ""

if (-not (Test-Path $downloadsFolder)) {
    Write-Host "[エラー] ダウンロードフォルダに data.js が見つかりません。" -ForegroundColor Red
    Write-Host "  ブラウザの編集モードから data.js をダウンロードしてから再実行してください。"
    Read-Host "Enterキーで終了"
    exit 1
}

# バックアップ作成
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$PSScriptRoot\..\data\data_backup_$timestamp.js"
if (Test-Path $destination) {
    Copy-Item $destination $backupPath
    Write-Host "[OK] 既存ファイルをバックアップしました: $backupPath" -ForegroundColor Green
}

# コピー実行
try {
    Copy-Item $downloadsFolder $destination -Force
    Write-Host "[OK] data.js を正常に配置しました。" -ForegroundColor Green
} catch {
    Write-Host "[エラー] ファイルの配置に失敗しました: $_" -ForegroundColor Red
    Read-Host "Enterキーで終了"
    exit 1
}

Write-Host ""
Write-Host "=== 完了 ===" -ForegroundColor Cyan
Read-Host "Enterキーで終了"
