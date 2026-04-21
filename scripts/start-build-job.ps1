param(
    [string]$WorkspaceRoot = "D:\Minecraft\AIBuilder\workspace",
    [string]$JobName = "villa-district-100",
    [int]$OriginX = 0,
    [int]$OriginY = 64,
    [int]$OriginZ = 0,
    [int]$Width = 400,
    [int]$Depth = 400,
    [int]$Count = 100,
    [int]$RoadWidth = 8,
    [int]$LotPadding = 4
)

$ErrorActionPreference = "Stop"

$botDir = Join-Path $WorkspaceRoot 'builder-bot'
Push-Location $botDir
try {
    $env:MINECRAFT_BUILDER_WORKSPACE = $WorkspaceRoot
    $env:BUILDER_JOB_NAME = $JobName
    $env:BUILDER_ORIGIN_X = "$OriginX"
    $env:BUILDER_ORIGIN_Y = "$OriginY"
    $env:BUILDER_ORIGIN_Z = "$OriginZ"
    $env:BUILDER_WIDTH = "$Width"
    $env:BUILDER_DEPTH = "$Depth"
    $env:BUILDER_COUNT = "$Count"
    $env:BUILDER_ROAD_WIDTH = "$RoadWidth"
    $env:BUILDER_LOT_PADDING = "$LotPadding"

    $jobPath = npm run generate:district --silent
    Write-Host "Planned build job: $jobPath"
    Write-Host "Next step in Codex: run the MCP tool 'build-villa-district' with jobId '$JobName'."
} finally {
    Pop-Location
}
