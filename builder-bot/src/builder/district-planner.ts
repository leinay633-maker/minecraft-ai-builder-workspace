import crypto from 'node:crypto';
import { BuildJob, BoundingBox, DistrictLot, DistrictPlanRequest, Rotation } from './types.js';
import { WorkspacePaths, sanitizeId } from './workspace.js';
import { createVillaBlueprint, rotatedFootprint, villaArchetypes } from './villa-catalog.js';

function rotationForIndex(index: number): Rotation {
  return ([0, 90, 180, 270] as Rotation[])[index % 4];
}

function lotBounds(anchorX: number, anchorY: number, anchorZ: number, width: number, depth: number, height: number): BoundingBox {
  return {
    minX: anchorX,
    minY: anchorY,
    minZ: anchorZ,
    maxX: anchorX + width - 1,
    maxY: anchorY + height - 1,
    maxZ: anchorZ + depth - 1
  };
}

export async function planVillaDistrict(workspace: WorkspacePaths, request: DistrictPlanRequest): Promise<BuildJob> {
  await workspace.ensure();
  const grid = Math.ceil(Math.sqrt(request.count));
  const lotSize = 32;
  const requiredWidth = grid * lotSize + (grid - 1) * request.roadWidth;
  const requiredDepth = grid * lotSize + (grid - 1) * request.roadWidth;

  if (request.width < requiredWidth || request.depth < requiredDepth) {
    throw new Error(
      `Requested area ${request.width}x${request.depth} is too small for ${request.count} villas. ` +
      `Need at least ${requiredWidth}x${requiredDepth}.`
    );
  }

  const archetypes = villaArchetypes();
  const lots: DistrictLot[] = [];

  for (let index = 0; index < request.count; index += 1) {
    const row = Math.floor(index / grid);
    const column = index % grid;
    const baseX = request.originX + column * (lotSize + request.roadWidth);
    const baseZ = request.originZ + row * (lotSize + request.roadWidth);
    const archetype = archetypes[index % archetypes.length];
    const seed = crypto.createHash('sha1').update(`${request.jobName}:${index}`).digest('hex').slice(0, 10);
    const blueprint = createVillaBlueprint(archetype, seed);
    blueprint.metadata.hash = workspace.hashDocument(blueprint.phases);
    await workspace.writeBlueprint(blueprint);

    const rotation = rotationForIndex(index);
    const rotated = rotatedFootprint(blueprint.metadata.footprint.width, blueprint.metadata.footprint.depth, rotation);
    const anchorX = baseX + request.lotPadding;
    const anchorZ = baseZ + request.lotPadding + Math.max(0, Math.floor((lotSize - request.lotPadding * 2 - rotated.depth) / 2));
    const anchorY = request.originY;

    lots.push({
      lotId: `lot-${String(index + 1).padStart(3, '0')}`,
      blueprintId: blueprint.metadata.id,
      displayName: blueprint.metadata.displayName,
      archetype,
      seed,
      anchor: { x: anchorX, y: anchorY, z: anchorZ },
      rotation,
      lotBounds: lotBounds(baseX, request.originY, baseZ, lotSize, lotSize, blueprint.metadata.footprint.height + 4),
      buildBounds: lotBounds(anchorX, anchorY, anchorZ, rotated.width, rotated.depth, blueprint.metadata.footprint.height),
      status: 'planned'
    });
  }

  const now = new Date().toISOString();
  const job: BuildJob = {
    schemaVersion: 1,
    id: sanitizeId(request.jobName),
    name: request.jobName,
    createdAt: now,
    updatedAt: now,
    status: 'planned',
    area: {
      minX: request.originX,
      minY: request.originY,
      minZ: request.originZ,
      maxX: request.originX + requiredWidth - 1,
      maxY: request.originY + 64,
      maxZ: request.originZ + requiredDepth - 1
    },
    roadWidth: request.roadWidth,
    lotPadding: request.lotPadding,
    count: request.count,
    currentLotIndex: 0,
    lots,
    failedLots: [],
    completedLots: []
  };

  await workspace.writeJob(job);
  return job;
}
