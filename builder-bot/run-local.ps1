param(
    [string]$ServerHost = "localhost",
    [int]$Port = 25565,
    [string]$Username = "CodexCliBot"
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath ".\dist\main.js")) {
    Write-Host "dist/main.js not found. Running npm install first..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

node .\dist\main.js --host $ServerHost --port $Port --username $Username
