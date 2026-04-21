import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { BuildJob, BlueprintDocument, BuildJobStatusSummary } from './types.js';

function normalizeJson(input: unknown): string {
  return JSON.stringify(input, null, 2) + '\n';
}

export function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export class WorkspacePaths {
  readonly root: string;
  readonly blueprintsDir: string;
  readonly generatedBlueprintsDir: string;
  readonly jobsDir: string;
  readonly logsDir: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.blueprintsDir = path.join(this.root, 'blueprints');
    this.generatedBlueprintsDir = path.join(this.blueprintsDir, 'generated');
    this.jobsDir = path.join(this.root, 'jobs');
    this.logsDir = path.join(this.root, 'logs');
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(this.blueprintsDir, { recursive: true });
    await fs.mkdir(this.generatedBlueprintsDir, { recursive: true });
    await fs.mkdir(this.jobsDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  blueprintPath(id: string): string {
    return path.join(this.generatedBlueprintsDir, `${sanitizeId(id)}.json`);
  }

  jobPath(id: string): string {
    return path.join(this.jobsDir, `${sanitizeId(id)}.json`);
  }

  async writeBlueprint(blueprint: BlueprintDocument): Promise<string> {
    const target = this.blueprintPath(blueprint.metadata.id);
    await fs.writeFile(target, normalizeJson(blueprint), 'utf8');
    return target;
  }

  async readBlueprint(idOrPath: string): Promise<BlueprintDocument> {
    const target = idOrPath.endsWith('.json') ? idOrPath : this.blueprintPath(idOrPath);
    const content = await fs.readFile(target, 'utf8');
    return JSON.parse(content) as BlueprintDocument;
  }

  async writeJob(job: BuildJob): Promise<string> {
    const target = this.jobPath(job.id);
    await fs.writeFile(target, normalizeJson(job), 'utf8');
    return target;
  }

  async readJob(jobId: string): Promise<BuildJob> {
    const content = await fs.readFile(this.jobPath(jobId), 'utf8');
    return JSON.parse(content) as BuildJob;
  }

  summarizeJob(job: BuildJob): BuildJobStatusSummary {
    return {
      id: job.id,
      name: job.name,
      status: job.status,
      totalLots: job.lots.length,
      currentLotIndex: job.currentLotIndex,
      completedLots: job.completedLots.length,
      failedLots: job.failedLots.length,
      nextLotId: job.lots[job.currentLotIndex]?.lotId ?? null
    };
  }

  hashDocument(document: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(document))
      .digest('hex')
      .slice(0, 16);
  }
}
