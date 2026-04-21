import test from 'ava';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { WorkspacePaths } from '../src/builder/workspace.js';
import { planVillaDistrict } from '../src/builder/district-planner.js';

test('planVillaDistrict creates 100 unique lots and blueprint ids', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-district-'));
  const workspace = new WorkspacePaths(root);
  const job = await planVillaDistrict(workspace, {
    jobName: 'villa-district-100',
    originX: 0,
    originY: 64,
    originZ: 0,
    width: 400,
    depth: 400,
    count: 100,
    roadWidth: 8,
    lotPadding: 4
  });

  t.is(job.lots.length, 100);
  t.is(new Set(job.lots.map((lot) => lot.blueprintId)).size, 100);
  t.true((await fs.stat(workspace.jobPath(job.id))).isFile());
});

test('planVillaDistrict rejects undersized districts', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-district-small-'));
  const workspace = new WorkspacePaths(root);

  await t.throwsAsync(
    () => planVillaDistrict(workspace, {
      jobName: 'too-small',
      originX: 0,
      originY: 64,
      originZ: 0,
      width: 64,
      depth: 64,
      count: 100,
      roadWidth: 8,
      lotPadding: 4
    }),
    { instanceOf: Error }
  );
});
