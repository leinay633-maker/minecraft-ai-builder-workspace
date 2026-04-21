import test from 'ava';
import sinon from 'sinon';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BotConnection } from '../src/bot-connection.js';
import type mineflayer from 'mineflayer';
import { ToolFactory } from '../src/tool-factory.js';
import { WorkspacePaths } from '../src/builder/workspace.js';
import { registerBuilderTools } from '../src/tools/builder-tools.js';

async function setupFactory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-tools-'));
  const workspace = new WorkspacePaths(root);
  await workspace.ensure();

  const mockServer = {
    tool: sinon.stub()
  } as unknown as McpServer;
  const mockConnection = {
    checkConnectionAndReconnect: sinon.stub().resolves({ connected: true })
  } as unknown as BotConnection;
  const factory = new ToolFactory(mockServer, mockConnection);
  const mockBot = {
    game: { gameMode: 'creative' },
    chat: sinon.stub(),
    waitForTicks: sinon.stub().resolves(),
    blockAt: sinon.stub().returns({ name: 'grass_block' })
  } as unknown as Partial<mineflayer.Bot>;

  registerBuilderTools(factory, () => mockBot as mineflayer.Bot, workspace);
  return { mockServer, workspace };
}

test('registerBuilderTools registers high-level build tools', async (t) => {
  const { mockServer } = await setupFactory();
  const names = (mockServer.tool as sinon.SinonStub).getCalls().map((call) => call.args[0]);

  t.true(names.includes('ensure-creative-mode'));
  t.true(names.includes('plan-villa-district'));
  t.true(names.includes('build-villa-district'));
  t.true(names.includes('resume-build-job'));
});

test('load-blueprint persists generated blueprint into workspace', async (t) => {
  const { mockServer, workspace } = await setupFactory();
  const toolCalls = (mockServer.tool as sinon.SinonStub).getCalls();
  const loadCall = toolCalls.find((call) => call.args[0] === 'load-blueprint');
  const executor = loadCall!.args[3];

  const result = await executor({ archetype: 'modern_cube', seed: 'seed-001' });

  t.true(result.content[0].text.includes('Blueprint saved'));
  const generated = await fs.readdir(workspace.generatedBlueprintsDir);
  t.true(generated.length > 0);
});
