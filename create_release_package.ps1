# Copies the portable Windows build to the repository root.
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$BuiltExe = Join-Path $ProjectRoot "isu-deck-ui\src-tauri\target\release\app.exe"
$OutputExe = Join-Path $ProjectRoot "IsuDeck.exe"

if (-not (Test-Path -LiteralPath $BuiltExe -PathType Leaf)) {
    throw "Portable build not found at '$BuiltExe'. Build it with 'npm run tauri build' first."
}

Copy-Item -LiteralPath $BuiltExe -Destination $OutputExe -Force
Write-Host "Portable IsuDeck executable created at: $OutputExe" -ForegroundColor Green
