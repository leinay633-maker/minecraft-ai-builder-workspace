import { z } from 'zod';
import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import { ToolFactory } from '../tool-factory.js';
import { WorkspacePaths } from '../builder/workspace.js';
import { createVillaBlueprint, villaArchetypes } from '../builder/villa-catalog.js';
import { planVillaDistrict } from '../builder/district-planner.js';
import { buildDistrict, clearBounds, ensureCreativeMode, executeBlueprint, scanBuildArea } from '../builder/build-executor.js';
import { BuildExecutionOptions, Rotation } from '../builder/types.js';

const strategySchema = z.enum(['auto', 'command', 'place']).optional();

function formatRotation(rotation: number): Rotation {
  const normalized = (((rotation % 360) + 360) % 360) as Rotation;
  if (normalized !== 0 && normalized !== 90 && normalized !== 180 && normalized !== 270) {
    throw new Error('Rotation must be one of 0, 90, 180, 270');
  }
  return normalized;
}

function summarizeBlueprint(blueprintPath: string, blockCount: number, footprint: { width: number; depth: number; height: number }, hash: string): string {
  return [
    `Blueprint saved to ${blueprintPath}`,
    `Hash: ${hash}`,
    `Footprint: ${footprint.width}w x ${footprint.depth}d x ${footprint.height}h`,
    `Estimated blocks: ${blockCount}`
  ].join('\n');
}

export function registerBuilderTools(factory: ToolFactory, getBot: () => mineflayer.Bot, workspace: WorkspacePaths): void {
  factory.registerTool(
    'ensure-creative-mode',
    'Ensure the bot is in creative mode before attempting large-scale building.',
    {},
    async () => {
      const bot = getBot();
      const message = await ensureCreativeMode(bot);
      return factory.createResponse(message);
    }
  );

  factory.registerTool(
    'scan-build-area',
    'Scan a rectangular build area and summarize the current terrain surface.',
    {
      minX: z.coerce.number(),
      minY: z.coerce.number(),
      minZ: z.coerce.number(),
      maxX: z.coerce.number(),
      maxY: z.coerce.number(),
      maxZ: z.coerce.number()
    },
    async ({ minX, minY, minZ, maxX, maxY, maxZ }) => {
      const bot = getBot();
      const summary = await scanBuildArea(
        bot,
        new Vec3(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ)),
        new Vec3(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ))
      );

      return factory.createResponse(
        [
          `Sampled columns: ${summary.sampledColumns}`,
          `Solid columns: ${summary.solidColumns}`,
          `Surface Y range: ${summary.minSurfaceY ?? 'n/a'} .. ${summary.maxSurfaceY ?? 'n/a'}`,
          `Top blocks: ${JSON.stringify(summary.topBlocks)}`
        ].join('\n')
      );
    }
  );

  factory.registerTool(
    'load-blueprint',
    'Generate or load a parameterized villa blueprint into the workspace blueprints directory.',
    {
      archetype: z.string().optional().describe(`Archetype. One of: ${villaArchetypes().join(', ')}`),
      seed: z.string().optional().describe('Seed used to generate a unique villa blueprint'),
      blueprintId: z.string().optional().describe('Existing blueprint id to load from workspace')
    },
    async ({ archetype, seed = String(Date.now()), blueprintId }) => {
      const blueprint = blueprintId
        ? await workspace.readBlueprint(blueprintId)
        : createVillaBlueprint(archetype ?? villaArchetypes()[0], seed);

      blueprint.metadata.hash = workspace.hashDocument(blueprint.phases);
      const blueprintPath = await workspace.writeBlueprint(blueprint);
      const blockCount = blueprint.phases.reduce((sum, phase) => sum + phase.operations.length, 0);
      return factory.createResponse(
        summarizeBlueprint(
          blueprintPath,
          blockCount,
          blueprint.metadata.footprint,
          blueprint.metadata.hash
        )
      );
    }
  );

  factory.registerTool(
    'plan-villa-district',
    'Plan and persist a 100-villa district job with unique villa seeds and lot assignments.',
    {
      jobName: z.string().default('villa-district-100'),
      originX: z.coerce.number(),
      originY: z.coerce.number(),
      originZ: z.coerce.number(),
      width: z.coerce.number().default(400),
      depth: z.coerce.number().default(400),
      count: z.coerce.number().int().positive().max(1000).default(100),
      roadWidth: z.coerce.number().int().positive().default(8),
      lotPadding: z.coerce.number().int().nonnegative().default(4)
    },
    async ({ jobName, originX, originY, originZ, width, depth, count, roadWidth, lotPadding }) => {
      const job = await planVillaDistrict(workspace, {
        jobName,
        originX,
        originY,
        originZ,
        width,
        depth,
        count,
        roadWidth,
        lotPadding
      });

      return factory.createResponse(
        [
          `Job saved to ${workspace.jobPath(job.id)}`,
          `Status: ${job.status}`,
          `Lots: ${job.lots.length}`,
          `Area: (${job.area.minX}, ${job.area.minY}, ${job.area.minZ}) -> (${job.area.maxX}, ${job.area.maxY}, ${job.area.maxZ})`,
          `First lot: ${job.lots[0]?.lotId ?? 'n/a'}`
        ].join('\n')
      );
    }
  );

  factory.registerTool(
    'build-from-blueprint',
    'Build a single blueprint at a target anchor using command mode when possible and physical placement as fallback.',
    {
      blueprintId: z.string(),
      anchorX: z.coerce.number(),
      anchorY: z.coerce.number(),
      anchorZ: z.coerce.number(),
      rotation: z.coerce.number().optional(),
      strategy: strategySchema,
      clearArea: z.coerce.boolean().optional()
    },
    async ({ blueprintId, anchorX, anchorY, anchorZ, rotation = 0, strategy = 'auto', clearArea = false }) => {
      const bot = getBot();
      const blueprint = await workspace.readBlueprint(blueprintId);
      const appliedRotation = formatRotation(rotation);
      const options: BuildExecutionOptions = {
        strategy,
        clearArea,
        failFast: true,
        progressLabel: blueprint.metadata.displayName
      };

      const result = await executeBlueprint(
        bot,
        blueprint,
        new Vec3(anchorX, anchorY, anchorZ),
        appliedRotation,
        options
      );
      return factory.createResponse(result.message);
    }
  );

  factory.registerTool(
    'build-villa-district',
    'Build an entire planned villa district job from the workspace jobs directory.',
    {
      jobId: z.string(),
      strategy: strategySchema,
      clearArea: z.coerce.boolean().optional(),
      failFast: z.coerce.boolean().optional()
    },
    async ({ jobId, strategy = 'auto', clearArea = true, failFast = true }) => {
      const bot = getBot();
      const job = await workspace.readJob(jobId);
      const updated = await buildDistrict(bot, workspace, job, {
        strategy,
        clearArea,
        failFast,
        progressLabel: job.name
      });
      const summary = workspace.summarizeJob(updated);
      return factory.createResponse(
        [
          `Job ${summary.id}: ${summary.status}`,
          `Completed lots: ${summary.completedLots}/${summary.totalLots}`,
          `Failed lots: ${summary.failedLots}`,
          `Next lot: ${summary.nextLotId ?? 'none'}`
        ].join('\n')
      );
    }
  );

  factory.registerTool(
    'get-build-job-status',
    'Read the persisted status of a villa build job.',
    {
      jobId: z.string()
    },
    async ({ jobId }) => {
      const summary = workspace.summarizeJob(await workspace.readJob(jobId));
      return factory.createResponse(JSON.stringify(summary, null, 2));
    }
  );

  factory.registerTool(
    'resume-build-job',
    'Resume a previously started villa district build job from its persisted state.',
    {
      jobId: z.string(),
      strategy: strategySchema,
      clearArea: z.coerce.boolean().optional(),
      failFast: z.coerce.boolean().optional()
    },
    async ({ jobId, strategy = 'auto', clearArea = false, failFast = false }) => {
      const bot = getBot();
      const job = await workspace.readJob(jobId);
      const resumed = await buildDistrict(bot, workspace, job, {
        strategy,
        clearArea,
        failFast,
        progressLabel: `${job.name} resume`
      });
      const summary = workspace.summarizeJob(resumed);
      return factory.createResponse(
        `Resumed ${summary.id}: ${summary.completedLots}/${summary.totalLots} complete, failed lots ${summary.failedLots}.`
      );
    }
  );

  factory.registerTool(
    'clear-test-lot',
    'Clear a bounded test lot so a blueprint can be rebuilt cleanly.',
    {
      minX: z.coerce.number(),
      minY: z.coerce.number(),
      minZ: z.coerce.number(),
      maxX: z.coerce.number(),
      maxY: z.coerce.number(),
      maxZ: z.coerce.number(),
      strategy: strategySchema
    },
    async ({ minX, minY, minZ, maxX, maxY, maxZ, strategy = 'auto' }) => {
      const bot = getBot();
      const message = await clearBounds(bot, {
        min: new Vec3(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ)),
        max: new Vec3(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ))
      }, strategy);
      return factory.createResponse(message);
    }
  );
}
