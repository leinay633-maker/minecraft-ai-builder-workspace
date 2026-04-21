import path from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  username: string;
  workspaceRoot: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  host: 'localhost',
  port: 25565,
  username: 'LLMBot',
  workspaceRoot: path.resolve(process.cwd(), '..')
};

function takeValue(args: string[], index: number, name: string): string {
  const next = args[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return next;
}

export function parseConfig(argv = process.argv.slice(2)): ServerConfig {
  const config: ServerConfig = { ...DEFAULT_CONFIG };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--host':
        config.host = takeValue(argv, index, '--host');
        index += 1;
        break;
      case '--port':
        config.port = Number(takeValue(argv, index, '--port'));
        if (!Number.isInteger(config.port) || config.port <= 0) {
          throw new Error(`Invalid --port value: ${argv[index + 1]}`);
        }
        index += 1;
        break;
      case '--username':
        config.username = takeValue(argv, index, '--username');
        index += 1;
        break;
      case '--workspace-root':
        config.workspaceRoot = path.resolve(takeValue(argv, index, '--workspace-root'));
        index += 1;
        break;
      case '--help':
      case '-h':
        throw new Error('Help requested. Supported flags: --host, --port, --username, --workspace-root');
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return config;
}
