param(
    [string]$WorkspaceRoot = "D:\Minecraft\AIBuilder\workspace",
    [string]$InstanceRoot = "D:\Minecraft\CodexClientControl\instance",
    [string]$ServerHost = "localhost",
    [int]$LanPort = 0,
    [string]$Username = "CodexBuilder"
)

$ErrorActionPreference = "Stop"

function Get-LanPortFromLog {
    param([string]$LogPath)

    if (-not (Test-Path -LiteralPath $LogPath)) {
        throw "Minecraft latest.log not found at $LogPath"
    }

    $lines = Get-Content -LiteralPath $LogPath -Tail 400
    $patterns = @(
        'Local game hosted on port (?<port>\d{4,5})',
        'Started serving on port (?<port>\d{4,5})',
        '本地游戏已在端口\s*(?<port>\d{4,5})\s*开放',
        'LAN.*?(?<port>\d{4,5})',
        'port (?<port>\d{4,5})'
    )

    foreach ($line in ($lines | Select-Object -Reverse)) {
        foreach ($pattern in $patterns) {
            $match = [regex]::Match($line, $pattern)
            if ($match.Success) {
                return [int]$match.Groups['port'].Value
            }
        }
    }

    throw "Could not detect the LAN port from latest.log. Open your test world to LAN first, or pass -LanPort explicitly."
}

$botDir = Join-Path $WorkspaceRoot 'builder-bot'
$entry = Join-Path $botDir 'dist\main.js'

if (-not (Test-Path -LiteralPath $entry)) {
    Push-Location $botDir
    try {
        npm install
    } finally {
        Pop-Location
    }
}

if ($LanPort -le 0) {
    $LanPort = Get-LanPortFromLog -LogPath (Join-Path $InstanceRoot 'logs\latest.log')
}

$env:MINECRAFT_BUILDER_WORKSPACE = $WorkspaceRoot
$logFile = Join-Path $WorkspaceRoot 'logs\last-mcp-launch.txt'
$launchSummary = "host=$ServerHost`nport=$LanPort`nusername=$Username`nstarted=$(Get-Date -Format o)`n"
Set-Content -LiteralPath $logFile -Value $launchSummary -Encoding UTF8

Push-Location $botDir
try {
    node .\dist\main.js --host $ServerHost --port $LanPort --username $Username --workspace-root $WorkspaceRoot
} finally {
    Pop-Location
}
