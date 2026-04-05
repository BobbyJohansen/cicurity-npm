// Loads cicurity.config.json by searching from cwd upward to ~/.cicurity/config.json.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  validateConfig,
  defaultConfig,
  type CicurityConfig,
  type ConfigError,
} from '../internal/config-validator.js';

const CONFIG_FILENAME = 'cicurity.config.json';
const GLOBAL_CONFIG = path.join(os.homedir(), '.cicurity', 'config.json');

export type { CicurityConfig };

export interface LoadConfigResult {
  config: CicurityConfig;
  configPath: string | null;
  errors: ConfigError[];
}

/**
 * Loads the nearest cicurity.config.json walking up from cwd,
 * then falls back to ~/.cicurity/config.json, then defaults.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<LoadConfigResult> {
  const candidates = [
    ...walkUp(cwd),
    GLOBAL_CONFIG,
  ];

  for (const candidate of candidates) {
    try {
      await fs.promises.access(candidate, fs.constants.R_OK);
      const raw = await fs.promises.readFile(candidate, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      const { config, errors } = validateConfig(parsed);
      return { config, configPath: candidate, errors };
    } catch {
      // Not found or unreadable — try next
    }
  }

  return { config: defaultConfig(), configPath: null, errors: [] };
}

/** Yields config file paths walking up from startDir to filesystem root */
function* walkUp(startDir: string): Generator<string> {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (true) {
    yield path.join(dir, CONFIG_FILENAME);
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
