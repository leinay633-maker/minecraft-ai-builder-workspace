export type BuildPhaseName =
  | 'foundation'
  | 'shell'
  | 'windows'
  | 'roof'
  | 'details'
  | 'landscaping';

export type Rotation = 0 | 90 | 180 | 270;

export interface RelativePoint {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface BuildOpBase {
  block: string;
}

export interface SetBlockOperation extends BuildOpBase {
  kind: 'set';
  position: RelativePoint;
}

export interface FillOperation extends BuildOpBase {
  kind: 'fill';
  from: RelativePoint;
  to: RelativePoint;
}

export type BlueprintOperation = SetBlockOperation | FillOperation;

export interface BlueprintPhase {
  name: BuildPhaseName;
  operations: BlueprintOperation[];
}

export interface BlueprintMetadata {
  id: string;
  displayName: string;
  archetype: string;
  seed: string;
  hash: string;
  summary: string;
  tags: string[];
  footprint: {
    width: number;
    depth: number;
    height: number;
  };
  parameters: Record<string, string | number | boolean>;
}

export interface BlueprintDocument {
  schemaVersion: 1;
  kind: 'villa_blueprint';
  metadata: BlueprintMetadata;
  origin: RelativePoint;
  phases: BlueprintPhase[];
}

export interface VillaSpec {
  archetype: string;
  seed: string;
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  roofStyle: 'flat' | 'gable' | 'terrace' | 'stepped' | 'pyramid';
  wallMaterial: string;
  trimMaterial: string;
  floorMaterial: string;
  roofMaterial: string;
  glassMaterial: string;
  hedgeMaterial: string;
  poolMaterial: string;
  doorMaterial: string;
  hasGarage: boolean;
  hasPool: boolean;
  hasBalcony: boolean;
  hasTower: boolean;
  hasCourtyard: boolean;
  hasSkylight: boolean;
  entryInset: number;
  balconyDepth: number;
}

export interface DistrictPlanRequest {
  jobName: string;
  originX: number;
  originY: number;
  originZ: number;
  width: number;
  depth: number;
  count: number;
  roadWidth: number;
  lotPadding: number;
}

export interface DistrictLot {
  lotId: string;
  blueprintId: string;
  displayName: string;
  archetype: string;
  seed: string;
  anchor: RelativePoint;
  rotation: Rotation;
  lotBounds: BoundingBox;
  buildBounds: BoundingBox;
  status: 'planned' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface BuildJob {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: 'planned' | 'running' | 'completed' | 'failed';
  area: BoundingBox;
  roadWidth: number;
  lotPadding: number;
  count: number;
  currentLotIndex: number;
  lots: DistrictLot[];
  failedLots: string[];
  completedLots: string[];
}

export interface BuildJobStatusSummary {
  id: string;
  name: string;
  status: BuildJob['status'];
  totalLots: number;
  currentLotIndex: number;
  completedLots: number;
  failedLots: number;
  nextLotId: string | null;
}

export interface BuildExecutionOptions {
  strategy: 'auto' | 'command' | 'place';
  clearArea: boolean;
  failFast: boolean;
  progressLabel: string;
}

export interface BuildExecutionResult {
  placedBlocks: number;
  usedCommandMode: boolean;
  message: string;
}
