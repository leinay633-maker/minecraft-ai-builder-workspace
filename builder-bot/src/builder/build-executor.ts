import prismarineItem from 'prismarine-item';
import minecraftData from 'minecraft-data';
import mineflayer, { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlueprintDocument, BlueprintOperation, BuildExecutionOptions, BuildExecutionResult, BuildJob, Rotation } from './types.js';
import { WorkspacePaths } from './workspace.js';

type BlockPlacement = { x: number; y: number; z: number; block: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseBlockName(block: string): string {
  return block.split('[')[0];
}

function rotatePoint(point: Vec3, rotation: Rotation): Vec3 {
  switch (rotation) {
    case 90:
      return new Vec3(-point.z, point.y, point.x);
    case 180:
      return new Vec3(-point.x, point.y, -point.z);
    case 270:
      return new Vec3(point.z, point.y, -point.x);
    case 0:
    default:
      return point.clone();
  }
}

function normalizeBounds(a: Vec3, b: Vec3): { from: Vec3; to: Vec3 } {
  return {
    from: new Vec3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)),
    to: new Vec3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z))
  };
}

export function expandOperation(operation: BlueprintOperation, anchor: Vec3, rotation: Rotation): BlockPlacement[] {
  if (operation.kind === 'set') {
    const offset = rotatePoint(new Vec3(operation.position.x, operation.position.y, operation.position.z), rotation);
    return [{
      x: anchor.x + offset.x,
      y: anchor.y + offset.y,
      z: anchor.z + offset.z,
      block: operation.block
    }];
  }

  const rotatedFrom = rotatePoint(new Vec3(operation.from.x, operation.from.y, operation.from.z), rotation);
  const rotatedTo = rotatePoint(new Vec3(operation.to.x, operation.to.y, operation.to.z), rotation);
  const normalized = normalizeBounds(rotatedFrom, rotatedTo);
  const placements: BlockPlacement[] = [];

  for (let x = normalized.from.x; x <= normalized.to.x; x += 1) {
    for (let y = normalized.from.y; y <= normalized.to.y; y += 1) {
      for (let z = normalized.from.z; z <= normalized.to.z; z += 1) {
        placements.push({
          x: anchor.x + x,
          y: anchor.y + y,
          z: anchor.z + z,
          block: operation.block
        });
      }
    }
  }

  return placements;
}

async function waitForGameMode(bot: Bot, mode: mineflayer.GameMode, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (bot.game.gameMode === mode) {
      return true;
    }
    await bot.waitForTicks(2);
  }
  return false;
}

async function ensureCreativeInventoryItem(bot: Bot, blockName: string): Promise<void> {
  const itemName = baseBlockName(blockName);
  const mcData = minecraftData(bot.version);
  const itemData = mcData.itemsByName[itemName];
  if (!itemData) {
    throw new Error(`Unknown item for creative placement: ${itemName}`);
  }

  const held = bot.heldItem;
  if (held?.name === itemName) {
    return;
  }

  if (!bot.creative) {
    throw new Error('Creative inventory API is not available');
  }

  const ItemCtor = (prismarineItem as unknown as (registry: unknown) => {
    new(type: number, count: number, metadata?: number): Parameters<typeof bot.creative.setInventorySlot>[1];
  })(bot.registry);
  const item = new ItemCtor(itemData.id, 64, undefined);
  await bot.creative.setInventorySlot(36, item);
  await bot.setQuickBarSlot(0);
  const equippedItem = (bot.inventory.slots[36] ?? item) as NonNullable<Parameters<typeof bot.equip>[0]>;
  await bot.equip(equippedItem, 'hand');
}

async function trySetBlockCommand(bot: Bot, placement: BlockPlacement): Promise<boolean> {
  bot.chat(`/setblock ${placement.x} ${placement.y} ${placement.z} ${placement.block} replace`);
  await bot.waitForTicks(2);
  const block = bot.blockAt(new Vec3(placement.x, placement.y, placement.z));
  return block?.name === baseBlockName(placement.block);
}

async function tryFillCommand(bot: Bot, operation: BlueprintOperation, anchor: Vec3, rotation: Rotation): Promise<boolean> {
  if (operation.kind === 'set') {
    const [placement] = expandOperation(operation, anchor, rotation);
    return trySetBlockCommand(bot, placement);
  }

  const rotatedFrom = rotatePoint(new Vec3(operation.from.x, operation.from.y, operation.from.z), rotation);
  const rotatedTo = rotatePoint(new Vec3(operation.to.x, operation.to.y, operation.to.z), rotation);
  const normalized = normalizeBounds(rotatedFrom, rotatedTo);
  const from = normalized.from.plus(anchor);
  const to = normalized.to.plus(anchor);

  bot.chat(`/fill ${from.x} ${from.y} ${from.z} ${to.x} ${to.y} ${to.z} ${operation.block} replace`);
  await bot.waitForTicks(2);
  const sample = bot.blockAt(from);
  return sample?.name === baseBlockName(operation.block);
}

async function placePhysicalBlock(bot: Bot, placement: BlockPlacement): Promise<void> {
  const target = new Vec3(placement.x, placement.y, placement.z);
  const current = bot.entity.position;
  const shouldFly = Boolean(bot.creative) && current.distanceTo(target.offset(0.5, 1.5, 3.5)) > 4;

  if (shouldFly) {
    await bot.creative.flyTo(target.offset(0.5, 1.5, 3.5));
  }

  const existing = bot.blockAt(target);
  if (existing?.name === baseBlockName(placement.block)) {
    return;
  }

  if (existing && existing.name !== 'air') {
    await bot.dig(existing);
  }

  await ensureCreativeInventoryItem(bot, placement.block);
  const faces = [
    new Vec3(0, -1, 0),
    new Vec3(0, 0, -1),
    new Vec3(0, 0, 1),
    new Vec3(1, 0, 0),
    new Vec3(-1, 0, 0),
    new Vec3(0, 1, 0)
  ];

  for (const face of faces) {
    const reference = bot.blockAt(target.plus(face));
    if (!reference || reference.name === 'air') {
      continue;
    }

    await bot.lookAt(target.offset(0.5, 0.5, 0.5), true);
    await bot.placeBlock(reference, face.scaled(-1));
    const placed = bot.blockAt(target);
    if (placed?.name === baseBlockName(placement.block)) {
      return;
    }
  }

  throw new Error(`Could not place ${placement.block} at (${placement.x}, ${placement.y}, ${placement.z})`);
}

async function executeOperation(
  bot: Bot,
  operation: BlueprintOperation,
  anchor: Vec3,
  rotation: Rotation,
  preferCommand: boolean
): Promise<{ usedCommandMode: boolean; blocks: number }> {
  if (preferCommand) {
    const filled = await tryFillCommand(bot, operation, anchor, rotation);
    if (filled) {
      if (operation.kind === 'set') {
        return { usedCommandMode: true, blocks: 1 };
      }

      const deltaX = Math.abs(operation.to.x - operation.from.x) + 1;
      const deltaY = Math.abs(operation.to.y - operation.from.y) + 1;
      const deltaZ = Math.abs(operation.to.z - operation.from.z) + 1;
      return { usedCommandMode: true, blocks: deltaX * deltaY * deltaZ };
    }
  }

  const placements = expandOperation(operation, anchor, rotation);
  for (const placement of placements) {
    await placePhysicalBlock(bot, placement);
  }
  return { usedCommandMode: false, blocks: placements.length };
}

export async function ensureCreativeMode(bot: Bot): Promise<string> {
  if (bot.game.gameMode === 'creative') {
    return 'Bot is already in creative mode.';
  }

  bot.chat(`/gamemode creative ${bot.username}`);
  const changed = await waitForGameMode(bot, 'creative', 4000);
  if (!changed) {
    throw new Error(
      'Failed to switch the bot into creative mode. Open the world to LAN with cheats enabled, then retry.'
    );
  }

  return 'Bot switched to creative mode.';
}

export async function scanBuildArea(bot: Bot, min: Vec3, max: Vec3): Promise<{
  sampledColumns: number;
  solidColumns: number;
  minSurfaceY: number | null;
  maxSurfaceY: number | null;
  topBlocks: Record<string, number>;
}> {
  const topBlocks = new Map<string, number>();
  let solidColumns = 0;
  let minSurfaceY: number | null = null;
  let maxSurfaceY: number | null = null;
  const sampleMaxY = Math.max(min.y, max.y + 32);

  for (let x = min.x; x <= max.x; x += 1) {
    for (let z = min.z; z <= max.z; z += 1) {
      let found = false;
      for (let y = sampleMaxY; y >= min.y; y -= 1) {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block || block.name === 'air' || block.name === 'cave_air') {
          continue;
        }

        found = true;
        solidColumns += 1;
        topBlocks.set(block.name, (topBlocks.get(block.name) ?? 0) + 1);
        minSurfaceY = minSurfaceY === null ? y : Math.min(minSurfaceY, y);
        maxSurfaceY = maxSurfaceY === null ? y : Math.max(maxSurfaceY, y);
        break;
      }

      if (!found) {
        topBlocks.set('air', (topBlocks.get('air') ?? 0) + 1);
      }
    }
  }

  return {
    sampledColumns: (max.x - min.x + 1) * (max.z - min.z + 1),
    solidColumns,
    minSurfaceY,
    maxSurfaceY,
    topBlocks: Object.fromEntries([...topBlocks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
  };
}

export async function executeBlueprint(
  bot: Bot,
  blueprint: BlueprintDocument,
  anchor: Vec3,
  rotation: Rotation,
  options: BuildExecutionOptions
): Promise<BuildExecutionResult> {
  await ensureCreativeMode(bot);
  let placedBlocks = 0;
  let commandOps = 0;
  let physicalOps = 0;

  const shouldPreferCommand = options.strategy !== 'place';

  for (const phase of blueprint.phases) {
    for (const operation of phase.operations) {
      if (operation.kind === 'set' && operation.block === 'air') {
        continue;
      }
      const result = await executeOperation(bot, operation, anchor, rotation, shouldPreferCommand);
      placedBlocks += result.blocks;
      if (result.usedCommandMode) {
        commandOps += 1;
      } else {
        physicalOps += 1;
      }
      await sleep(15);
    }
  }

  return {
    placedBlocks,
    usedCommandMode: commandOps > 0 && physicalOps === 0,
    message: `${options.progressLabel}: placed ${placedBlocks} blocks (${commandOps} command ops, ${physicalOps} physical ops).`
  };
}

export async function clearBounds(bot: Bot, bounds: { min: Vec3; max: Vec3 }, strategy: BuildExecutionOptions['strategy']): Promise<string> {
  const preferCommand = strategy !== 'place';
  if (preferCommand) {
    bot.chat(`/fill ${bounds.min.x} ${bounds.min.y} ${bounds.min.z} ${bounds.max.x} ${bounds.max.y} ${bounds.max.z} air replace`);
    await bot.waitForTicks(2);
    return `Cleared bounds (${bounds.min.x}, ${bounds.min.y}, ${bounds.min.z}) -> (${bounds.max.x}, ${bounds.max.y}, ${bounds.max.z}) with /fill.`;
  }

  for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y <= bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
        const block = bot.blockAt(new Vec3(x, y, z));
        if (!block || block.name === 'air') {
          continue;
        }
        await bot.dig(block);
      }
    }
  }
  return `Cleared bounds (${bounds.min.x}, ${bounds.min.y}, ${bounds.min.z}) -> (${bounds.max.x}, ${bounds.max.y}, ${bounds.max.z}) by digging.`;
}

export async function buildDistrict(
  bot: Bot,
  workspace: WorkspacePaths,
  job: BuildJob,
  options: BuildExecutionOptions
): Promise<BuildJob> {
  job.status = 'running';
  job.updatedAt = new Date().toISOString();
  await workspace.writeJob(job);

  for (let index = job.currentLotIndex; index < job.lots.length; index += 1) {
    const lot = job.lots[index];
    lot.status = 'in_progress';
    job.currentLotIndex = index;
    job.updatedAt = new Date().toISOString();
    await workspace.writeJob(job);

    try {
      const blueprint = await workspace.readBlueprint(lot.blueprintId);
      const anchor = new Vec3(lot.anchor.x, lot.anchor.y, lot.anchor.z);
      if (options.clearArea) {
        await clearBounds(bot, {
          min: new Vec3(lot.buildBounds.minX, lot.buildBounds.minY, lot.buildBounds.minZ),
          max: new Vec3(lot.buildBounds.maxX, lot.buildBounds.maxY, lot.buildBounds.maxZ)
        }, options.strategy);
      }
      await executeBlueprint(bot, blueprint, anchor, lot.rotation, {
        ...options,
        progressLabel: lot.displayName
      });
      lot.status = 'completed';
      lot.error = undefined;
      if (!job.completedLots.includes(lot.lotId)) {
        job.completedLots.push(lot.lotId);
      }
    } catch (error) {
      lot.status = 'failed';
      lot.error = error instanceof Error ? error.message : String(error);
      if (!job.failedLots.includes(lot.lotId)) {
        job.failedLots.push(lot.lotId);
      }
      job.status = 'failed';
      job.updatedAt = new Date().toISOString();
      await workspace.writeJob(job);
      if (options.failFast) {
        throw error;
      }
    }

    job.updatedAt = new Date().toISOString();
    await workspace.writeJob(job);
  }

  job.status = job.failedLots.length > 0 ? 'failed' : 'completed';
  job.updatedAt = new Date().toISOString();
  await workspace.writeJob(job);
  return job;
}
