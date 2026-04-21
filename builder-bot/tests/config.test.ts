import test from 'ava';
import path from 'node:path';
import { parseConfig } from '../src/config.js';

test('parseConfig returns default values', (t) => {
  const config = parseConfig([]);
  
  t.is(config.host, 'localhost');
  t.is(config.port, 25565);
  t.is(config.username, 'LLMBot');
  t.is(config.workspaceRoot, path.resolve(process.cwd(), '..'));
});

test('parseConfig parses custom host', (t) => {
  const config = parseConfig(['--host', 'example.com']);
  
  t.is(config.host, 'example.com');
  t.is(config.port, 25565);
  t.is(config.username, 'LLMBot');
});

test('parseConfig parses custom port', (t) => {
  const config = parseConfig(['--port', '12345']);
  
  t.is(config.host, 'localhost');
  t.is(config.port, 12345);
  t.is(config.username, 'LLMBot');
});

test('parseConfig parses custom username', (t) => {
  const config = parseConfig(['--username', 'CustomBot']);
  
  t.is(config.host, 'localhost');
  t.is(config.port, 25565);
  t.is(config.username, 'CustomBot');
});

test('parseConfig parses all custom options', (t) => {
  const config = parseConfig(['--host', 'server.net', '--port', '9999', '--username', 'TestBot', '--workspace-root', 'D:\\Minecraft\\AIBuilder\\workspace']);
  
  t.is(config.host, 'server.net');
  t.is(config.port, 9999);
  t.is(config.username, 'TestBot');
  t.is(config.workspaceRoot, path.resolve('D:\\Minecraft\\AIBuilder\\workspace'));
});

test('parseConfig handles numeric port as number type', (t) => {
  const config = parseConfig(['--port', '30000']);
  
  t.is(typeof config.port, 'number');
  t.is(config.port, 30000);
});

test('parseConfig rejects unknown arguments', (t) => {
  const error = t.throws(() => parseConfig(['--mystery']));
  t.true(error?.message.includes('Unknown argument'));
});
