import { BlueprintDocument, BlueprintOperation, BlueprintPhase, BuildPhaseName, RelativePoint, Rotation, VillaSpec } from './types.js';

const PHASE_ORDER: BuildPhaseName[] = [
  'foundation',
  'shell',
  'windows',
  'roof',
  'details',
  'landscaping'
];

const ARCHETYPES = [
  'modern_cube',
  'double_wing',
  'euro_manor',
  'terrace_stack',
  'cliff_house',
  'glass_courtyard',
  'garden_estate',
  'tower_villa'
] as const;

type ArchetypeName = typeof ARCHETYPES[number];

const MATERIAL_PALETTES = [
  {
    wall: 'quartz_block',
    trim: 'smooth_stone',
    floor: 'birch_planks',
    roof: 'stone_bricks',
    glass: 'glass',
    hedge: 'oak_leaves',
    pool: 'water',
    door: 'oak_door'
  },
  {
    wall: 'sandstone',
    trim: 'cut_sandstone',
    floor: 'spruce_planks',
    roof: 'dark_oak_planks',
    glass: 'glass',
    hedge: 'azalea_leaves',
    pool: 'water',
    door: 'spruce_door'
  },
  {
    wall: 'white_concrete',
    trim: 'light_gray_concrete',
    floor: 'oak_planks',
    roof: 'gray_concrete',
    glass: 'glass',
    hedge: 'moss_block',
    pool: 'water',
    door: 'jungle_door'
  },
  {
    wall: 'stone_bricks',
    trim: 'polished_andesite',
    floor: 'dark_oak_planks',
    roof: 'deepslate_tiles',
    glass: 'glass',
    hedge: 'mangrove_leaves',
    pool: 'water',
    door: 'dark_oak_door'
  }
] as const;

class SeededRandom {
  private state: number;

  constructor(seed: string) {
    let hash = 2166136261;
    for (const char of seed) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    this.state = hash >>> 0;
  }

  next(): number {
    this.state += 0x6D2B79F5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }
}

class BlueprintBuilder {
  private phaseMap = new Map<BuildPhaseName, BlueprintOperation[]>();

  constructor() {
    for (const phase of PHASE_ORDER) {
      this.phaseMap.set(phase, []);
    }
  }

  addSet(phase: BuildPhaseName, position: RelativePoint, block: string): void {
    this.phaseMap.get(phase)!.push({ kind: 'set', position, block });
  }

  addFill(phase: BuildPhaseName, from: RelativePoint, to: RelativePoint, block: string): void {
    this.phaseMap.get(phase)!.push({ kind: 'fill', from, to, block });
  }

  addHollowBox(
    phase: BuildPhaseName,
    from: RelativePoint,
    to: RelativePoint,
    wallBlock: string,
    floorBlock?: string,
    ceilingBlock?: string
  ): void {
    this.addFill(phase, { x: from.x, y: from.y, z: from.z }, { x: to.x, y: from.y, z: to.z }, floorBlock ?? wallBlock);
    this.addFill(phase, { x: from.x, y: to.y, z: from.z }, { x: to.x, y: to.y, z: to.z }, ceilingBlock ?? wallBlock);
    this.addFill(phase, { x: from.x, y: from.y + 1, z: from.z }, { x: from.x, y: to.y - 1, z: to.z }, wallBlock);
    this.addFill(phase, { x: to.x, y: from.y + 1, z: from.z }, { x: to.x, y: to.y - 1, z: to.z }, wallBlock);
    this.addFill(phase, { x: from.x + 1, y: from.y + 1, z: from.z }, { x: to.x - 1, y: to.y - 1, z: from.z }, wallBlock);
    this.addFill(phase, { x: from.x + 1, y: from.y + 1, z: to.z }, { x: to.x - 1, y: to.y - 1, z: to.z }, wallBlock);
  }

  phases(): BlueprintPhase[] {
    return PHASE_ORDER.map((name) => ({ name, operations: this.phaseMap.get(name)! }));
  }
}

function createSpec(archetype: ArchetypeName, seed: string): VillaSpec {
  const rng = new SeededRandom(`${archetype}:${seed}`);
  const palette = rng.pick(MATERIAL_PALETTES);
  const width = archetype === 'tower_villa' ? rng.int(14, 18) : rng.int(16, 24);
  const depth = archetype === 'cliff_house' ? rng.int(18, 26) : rng.int(16, 24);
  const floors = archetype === 'tower_villa' ? 3 : rng.int(2, 3);

  return {
    archetype,
    seed,
    width,
    depth,
    floors,
    floorHeight: rng.int(4, 5),
    roofStyle: rng.pick(['flat', 'gable', 'terrace', 'stepped', 'pyramid']),
    wallMaterial: palette.wall,
    trimMaterial: palette.trim,
    floorMaterial: palette.floor,
    roofMaterial: palette.roof,
    glassMaterial: palette.glass,
    hedgeMaterial: palette.hedge,
    poolMaterial: palette.pool,
    doorMaterial: palette.door,
    hasGarage: archetype !== 'glass_courtyard' && rng.bool(0.55),
    hasPool: rng.bool(0.45),
    hasBalcony: rng.bool(0.6),
    hasTower: archetype === 'tower_villa' || rng.bool(0.2),
    hasCourtyard: archetype === 'glass_courtyard' || rng.bool(0.35),
    hasSkylight: rng.bool(0.5),
    entryInset: rng.int(2, 4),
    balconyDepth: rng.int(2, 3)
  };
}

function addWindowBand(builder: BlueprintBuilder, y: number, width: number, depth: number, glass: string): void {
  builder.addFill('windows', { x: 2, y, z: 0 }, { x: width - 3, y, z: 0 }, glass);
  builder.addFill('windows', { x: 2, y, z: depth - 1 }, { x: width - 3, y, z: depth - 1 }, glass);
  builder.addFill('windows', { x: 0, y, z: 2 }, { x: 0, y, z: depth - 3 }, glass);
  builder.addFill('windows', { x: width - 1, y, z: 2 }, { x: width - 1, y, z: depth - 3 }, glass);
}

function addRoof(builder: BlueprintBuilder, spec: VillaSpec, baseY: number): number {
  const { width, depth, roofStyle, roofMaterial, trimMaterial } = spec;

  switch (roofStyle) {
    case 'flat':
      builder.addFill('roof', { x: 0, y: baseY, z: 0 }, { x: width - 1, y: baseY, z: depth - 1 }, roofMaterial);
      if (spec.hasSkylight) {
        builder.addFill('details', { x: 3, y: baseY, z: 3 }, { x: width - 4, y: baseY, z: depth - 4 }, spec.glassMaterial);
      }
      return 1;
    case 'terrace':
      builder.addFill('roof', { x: 0, y: baseY, z: 0 }, { x: width - 1, y: baseY, z: depth - 1 }, roofMaterial);
      builder.addHollowBox(
        'details',
        { x: 0, y: baseY + 1, z: 0 },
        { x: width - 1, y: baseY + 2, z: depth - 1 },
        trimMaterial
      );
      return 3;
    case 'gable': {
      const layers = Math.ceil(Math.min(width, depth) / 4);
      for (let layer = 0; layer < layers; layer += 1) {
        builder.addFill(
          'roof',
          { x: layer, y: baseY + layer, z: layer },
          { x: width - 1 - layer, y: baseY + layer, z: depth - 1 - layer },
          roofMaterial
        );
      }
      return layers;
    }
    case 'pyramid': {
      const layers = Math.floor(Math.min(width, depth) / 3);
      for (let layer = 0; layer < layers; layer += 1) {
        builder.addFill(
          'roof',
          { x: layer, y: baseY + layer, z: layer },
          { x: width - 1 - layer, y: baseY + layer, z: depth - 1 - layer },
          roofMaterial
        );
      }
      return layers;
    }
    case 'stepped':
    default: {
      const mid = Math.floor(depth / 2);
      for (let z = 0; z < depth; z += 1) {
        const height = baseY + Math.max(0, mid - Math.abs(mid - z));
        builder.addFill('roof', { x: 0, y: height, z }, { x: width - 1, y: height, z }, roofMaterial);
      }
      return mid + 1;
    }
  }
}

function addEntrance(builder: BlueprintBuilder, spec: VillaSpec): void {
  const center = Math.floor(spec.width / 2);
  builder.addFill('details', { x: center - 1, y: 1, z: 0 }, { x: center, y: 2, z: 0 }, 'air');
  builder.addSet('details', { x: center - 1, y: 1, z: 0 }, spec.doorMaterial);
  builder.addSet('details', { x: center, y: 1, z: 0 }, spec.doorMaterial);
  builder.addFill('details', { x: center - 2, y: 0, z: 1 }, { x: center + 1, y: 0, z: 2 }, spec.trimMaterial);
}

function addGarage(builder: BlueprintBuilder, spec: VillaSpec): void {
  if (!spec.hasGarage) {
    return;
  }

  const garageWidth = Math.max(6, Math.floor(spec.width / 3));
  const startX = spec.width;
  builder.addFill('foundation', { x: startX, y: 0, z: 2 }, { x: startX + garageWidth, y: 0, z: spec.depth - 4 }, spec.trimMaterial);
  builder.addHollowBox(
    'shell',
    { x: startX, y: 1, z: 2 },
    { x: startX + garageWidth, y: spec.floorHeight, z: spec.depth - 4 },
    spec.wallMaterial,
    spec.floorMaterial,
    spec.trimMaterial
  );
  builder.addFill('details', { x: startX + 1, y: 1, z: 2 }, { x: startX + garageWidth - 1, y: spec.floorHeight - 1, z: 2 }, 'air');
}

function addCourtyard(builder: BlueprintBuilder, spec: VillaSpec): void {
  if (!spec.hasCourtyard) {
    return;
  }

  const inset = 4;
  builder.addFill(
    'foundation',
    { x: inset, y: 0, z: inset },
    { x: spec.width - 1 - inset, y: 0, z: spec.depth - 1 - inset },
    'grass_block'
  );
  builder.addFill(
    'details',
    { x: inset + 1, y: 1, z: inset + 1 },
    { x: spec.width - 2 - inset, y: 1, z: spec.depth - 2 - inset },
    'air'
  );
  builder.addFill(
    'landscaping',
    { x: inset + 1, y: 1, z: inset + 1 },
    { x: spec.width - 2 - inset, y: 1, z: inset + 1 },
    spec.hedgeMaterial
  );
}

function addBalcony(builder: BlueprintBuilder, spec: VillaSpec, secondFloorY: number): void {
  if (!spec.hasBalcony || spec.floors < 2) {
    return;
  }

  const left = 3;
  const right = spec.width - 4;
  for (let z = -spec.balconyDepth; z < 0; z += 1) {
    builder.addFill('details', { x: left, y: secondFloorY, z }, { x: right, y: secondFloorY, z }, spec.floorMaterial);
  }
  builder.addFill('details', { x: left, y: secondFloorY + 1, z: -spec.balconyDepth }, { x: right, y: secondFloorY + 1, z: -spec.balconyDepth }, spec.trimMaterial);
}

function addTower(builder: BlueprintBuilder, spec: VillaSpec): void {
  if (!spec.hasTower) {
    return;
  }

  const towerSize = 5;
  const baseX = spec.width - towerSize - 1;
  const baseZ = spec.depth - towerSize - 1;
  const towerTop = spec.floors * spec.floorHeight + 4;
  builder.addFill('foundation', { x: baseX, y: 0, z: baseZ }, { x: baseX + towerSize, y: 0, z: baseZ + towerSize }, spec.trimMaterial);
  builder.addHollowBox(
    'shell',
    { x: baseX, y: 1, z: baseZ },
    { x: baseX + towerSize, y: towerTop, z: baseZ + towerSize },
    spec.wallMaterial,
    spec.floorMaterial,
    spec.trimMaterial
  );
  builder.addFill('windows', { x: baseX + 2, y: towerTop - 2, z: baseZ }, { x: baseX + 3, y: towerTop - 2, z: baseZ }, spec.glassMaterial);
  builder.addFill('roof', { x: baseX, y: towerTop + 1, z: baseZ }, { x: baseX + towerSize, y: towerTop + 1, z: baseZ + towerSize }, spec.roofMaterial);
}

function addPoolAndGarden(builder: BlueprintBuilder, spec: VillaSpec): void {
  const gardenZ = spec.depth + 3;
  builder.addFill(
    'landscaping',
    { x: 0, y: 0, z: gardenZ },
    { x: spec.width - 1, y: 0, z: gardenZ + 6 },
    'grass_block'
  );
  builder.addFill('landscaping', { x: 0, y: 1, z: gardenZ }, { x: spec.width - 1, y: 1, z: gardenZ }, spec.hedgeMaterial);
  builder.addFill('landscaping', { x: 0, y: 1, z: gardenZ + 6 }, { x: spec.width - 1, y: 1, z: gardenZ + 6 }, spec.hedgeMaterial);

  if (spec.hasPool) {
    builder.addFill(
      'landscaping',
      { x: 2, y: 0, z: gardenZ + 1 },
      { x: Math.min(spec.width - 3, 8), y: 0, z: gardenZ + 4 },
      spec.trimMaterial
    );
    builder.addFill(
      'landscaping',
      { x: 3, y: 0, z: gardenZ + 2 },
      { x: Math.min(spec.width - 4, 7), y: 0, z: gardenZ + 3 },
      spec.poolMaterial
    );
  }
}

function buildVilla(spec: VillaSpec): BlueprintPhase[] {
  const builder = new BlueprintBuilder();
  const totalHeight = spec.floors * spec.floorHeight;

  builder.addFill('foundation', { x: 0, y: 0, z: 0 }, { x: spec.width - 1, y: 0, z: spec.depth - 1 }, spec.trimMaterial);
  builder.addFill('foundation', { x: 1, y: 1, z: 1 }, { x: spec.width - 2, y: 1, z: spec.depth - 2 }, spec.floorMaterial);

  for (let floor = 0; floor < spec.floors; floor += 1) {
    const floorBaseY = 1 + floor * spec.floorHeight;
    const floorTopY = floorBaseY + spec.floorHeight - 1;
    builder.addHollowBox(
      'shell',
      { x: 0, y: floorBaseY, z: 0 },
      { x: spec.width - 1, y: floorTopY, z: spec.depth - 1 },
      spec.wallMaterial,
      spec.floorMaterial,
      spec.trimMaterial
    );
    addWindowBand(builder, floorBaseY + 1, spec.width, spec.depth, spec.glassMaterial);
  }

  addEntrance(builder, spec);
  addGarage(builder, spec);
  addCourtyard(builder, spec);
  addBalcony(builder, spec, 1 + spec.floorHeight);
  addTower(builder, spec);
  addPoolAndGarden(builder, spec);
  const roofHeight = addRoof(builder, spec, totalHeight + 1);

  if (spec.entryInset > 0) {
    builder.addFill(
      'details',
      { x: spec.entryInset, y: 0, z: -3 },
      { x: spec.width - 1 - spec.entryInset, y: 0, z: -1 },
      spec.floorMaterial
    );
  }

  builder.addFill(
    'landscaping',
    { x: -1, y: 0, z: -4 },
    { x: spec.width, y: 0, z: -4 },
    'stone_bricks'
  );

  const phases = builder.phases();
  phases[0].operations.push({
    kind: 'fill',
    from: { x: 0, y: totalHeight + roofHeight + 3, z: 0 },
    to: { x: 0, y: totalHeight + roofHeight + 3, z: 0 },
    block: 'air'
  });
  return phases;
}

export function createVillaBlueprint(archetype: string, seed: string): BlueprintDocument {
  const resolvedArchetype = (ARCHETYPES.includes(archetype as ArchetypeName)
    ? archetype
    : ARCHETYPES[Math.abs(seed.length) % ARCHETYPES.length]) as ArchetypeName;
  const spec = createSpec(resolvedArchetype, seed);
  const phases = buildVilla(spec);
  const roofHeight = spec.roofStyle === 'flat' ? 1 : Math.max(2, Math.ceil(Math.min(spec.width, spec.depth) / 4));
  const maxWidth = spec.hasGarage ? spec.width + Math.max(6, Math.floor(spec.width / 3)) + 1 : spec.width;
  const maxDepth = spec.depth + 10;

  return {
    schemaVersion: 1,
    kind: 'villa_blueprint',
    metadata: {
      id: `${resolvedArchetype}-${seed}`,
      displayName: `${resolvedArchetype.replace(/_/g, ' ')} ${seed}`,
      archetype: resolvedArchetype,
      seed,
      hash: '',
      summary: `${spec.floors}-floor ${resolvedArchetype.replace(/_/g, ' ')} villa with ${spec.roofStyle} roof`,
      tags: [
        resolvedArchetype,
        spec.roofStyle,
        spec.hasPool ? 'pool' : 'no-pool',
        spec.hasGarage ? 'garage' : 'no-garage'
      ],
      footprint: {
        width: maxWidth,
        depth: maxDepth,
        height: spec.floors * spec.floorHeight + roofHeight + 4
      },
      parameters: {
        width: spec.width,
        depth: spec.depth,
        floors: spec.floors,
        roofStyle: spec.roofStyle,
        hasGarage: spec.hasGarage,
        hasPool: spec.hasPool,
        hasBalcony: spec.hasBalcony,
        hasTower: spec.hasTower,
        hasCourtyard: spec.hasCourtyard,
        wallMaterial: spec.wallMaterial,
        roofMaterial: spec.roofMaterial
      }
    },
    origin: { x: 0, y: 0, z: 0 },
    phases
  };
}

export function villaArchetypes(): string[] {
  return [...ARCHETYPES];
}

export function rotatedFootprint(width: number, depth: number, rotation: Rotation): { width: number; depth: number } {
  return rotation === 90 || rotation === 270 ? { width: depth, depth: width } : { width, depth };
}
