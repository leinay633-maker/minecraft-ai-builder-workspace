import { WorkspacePaths } from '../builder/workspace.js';
import { planVillaDistrict } from '../builder/district-planner.js';

async function main() {
  const workspaceRoot = process.env.MINECRAFT_BUILDER_WORKSPACE ?? 'D:\\Minecraft\\AIBuilder\\workspace';
  const workspace = new WorkspacePaths(workspaceRoot);
  const job = await planVillaDistrict(workspace, {
    jobName: process.env.BUILDER_JOB_NAME ?? 'villa-district-100',
    originX: Number(process.env.BUILDER_ORIGIN_X ?? 0),
    originY: Number(process.env.BUILDER_ORIGIN_Y ?? 64),
    originZ: Number(process.env.BUILDER_ORIGIN_Z ?? 0),
    width: Number(process.env.BUILDER_WIDTH ?? 400),
    depth: Number(process.env.BUILDER_DEPTH ?? 400),
    count: Number(process.env.BUILDER_COUNT ?? 100),
    roadWidth: Number(process.env.BUILDER_ROAD_WIDTH ?? 8),
    lotPadding: Number(process.env.BUILDER_LOT_PADDING ?? 4)
  });

  process.stdout.write(`${workspace.jobPath(job.id)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
