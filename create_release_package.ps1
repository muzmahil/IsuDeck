# IsuDeck Release Packaging Script
$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\IsuDeck"
$OutputDir = Join-Path $ProjectRoot "release_package"
$ZipFile = Join-Path $ProjectRoot "IsuDeck_Portable_v1.0.0.zip"

Write-Host "Creating IsuDeck Release Package..." -ForegroundColor Cyan

if (Test-Path $OutputDir) {
    Remove-Item -Path $OutputDir -Recurse -Force
}
if (Test-Path $ZipFile) {
    Remove-Item -Path $ZipFile -Force
}

New-Item -ItemType Directory -Path $OutputDir | Out-Null

Copy-Item -Path (Join-Path $ProjectRoot "IsuDeck.exe") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "interception.dll") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "LICENSE") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "LICENSE.md") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "README.md") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "KULLANIM_KILAVUZU.md") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "USER_GUIDE.md") -Destination $OutputDir -Force
Copy-Item -Path (Join-Path $ProjectRoot "PLUGIN_SDK.md") -Destination $OutputDir -Force

Copy-Item -Path (Join-Path $ProjectRoot "drivers") -Destination $OutputDir -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "plugins") -Destination $OutputDir -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "sounds") -Destination $OutputDir -Recurse -Force

Write-Host "Compressing into $ZipFile..." -ForegroundColor Cyan
Compress-Archive -Path "$OutputDir\*" -DestinationPath $ZipFile -CompressionLevel Optimal

Write-Host "Release Package Successfully Created at: $ZipFile" -ForegroundColor Green
