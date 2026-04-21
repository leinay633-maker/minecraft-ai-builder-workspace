# Minecraft AI Builder Workspace

Codex-ready Minecraft building workspace for large-scale creative-mode construction with Mineflayer, MCP, resumable build jobs, and parameterized villa blueprints.

This repository packages:

- a local MCP server in `builder-bot/`
- high-level builder tools for district planning and blueprint execution
- PowerShell entry scripts for starting the bot and generating build jobs
- a workspace layout for blueprints, jobs, and logs

## What this adds on top of `minecraft-mcp-server`

This project is based on the MIT-licensed [`yuniko-software/minecraft-mcp-server`](https://github.com/yuniko-software/minecraft-mcp-server) and extends it with:

- `ensure-creative-mode`
- `scan-build-area`
- `load-blueprint`
- `plan-villa-district`
- `build-from-blueprint`
- `build-villa-district`
- `get-build-job-status`
- `resume-build-job`
- `clear-test-lot`

It also adds a parameterized villa generator and batch job planner for building 100 unique villas in a planned district.

## Repository Layout

- `builder-bot/` - MCP server source, tests, and package metadata
- `scripts/start-minecraft-bot.ps1` - launches the MCP server and auto-detects LAN ports when possible
- `scripts/start-build-job.ps1` - generates a default district job
- `blueprints/` - generated blueprint workspace
- `jobs/` - persisted build-job workspace
- `logs/` - launch/run logs
- `.mcp.example.json` - example project-level MCP config

Generated blueprints, jobs, logs, `dist/`, and `node_modules/` are intentionally excluded from version control.

## Requirements

- Minecraft Java Edition `1.21.11`
- Node.js `>= 20.10.0`
- A Minecraft client or world you can open to LAN with cheats enabled
- A Model Context Protocol client such as Codex or Claude Desktop

## Quick Start

1. Install dependencies:

```powershell
cd builder-bot
npm install
```

2. Open a Minecraft test world to LAN with cheats enabled.

3. Copy `.mcp.example.json` to `.mcp.json` and adjust the paths for your machine.

4. Start the workspace from your MCP client in the repository root.

5. Generate a default 100-villa district job:

```powershell
pwsh -File .\scripts\start-build-job.ps1
```

6. From your MCP client, call:

- `ensure-creative-mode`
- `plan-villa-district` or use the generated default job
- `build-villa-district`

## Notes

- The bot prefers command-mode building (`/setblock` and `/fill`) when available, and falls back to physical placement when needed.
- The intended first validation target is a disposable **test world**, not a production build world.
- Build jobs are resumable and persisted under `jobs/`.

## License

This repository is released under the MIT License. It contains derivative work based on `yuniko-software/minecraft-mcp-server`, which is also MIT-licensed.
