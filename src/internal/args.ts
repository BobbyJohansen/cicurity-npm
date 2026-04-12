// CLI argument parser - no commander dependency.
// Handles all cicurity invocation styles.

export type SupportedTool = 'npm' | 'pnpm' | 'npx';

export interface ParsedInstall {
  command: 'install';
  tool: SupportedTool;
  /** Raw package specifiers exactly as the user typed them, e.g. ["express", "lodash@4"] */
  packages: string[];
  /** All original argv tokens after the tool/subcommand, passed through to the real tool */
  passthroughArgs: string[];
  flags: {
    json: boolean;
    force: boolean;
    saveDev: boolean;
    saveOptional: boolean;
    /** pnpm: -P / --save-peer */
    savePeer: boolean;
    global: boolean;
  };
  /** Optional project name for the analyzer report (--project / -p) */
  project?: string;
}

export interface ParsedUnknown {
  command: 'unknown';
  /** The raw argv slice cicurity received */
  raw: string[];
}

export type ParsedCommand = ParsedInstall | ParsedUnknown;

/** Subcommand aliases that mean "install packages" for each tool */
const INSTALL_SUBCOMMANDS: Record<SupportedTool, Set<string>> = {
  npm: new Set(['install', 'i', 'add', 'isntall']),
  pnpm: new Set(['install', 'i', 'add']),
  npx: new Set(['exec', 'x', '']), // npx <pkg> has no explicit subcommand
};

const INSTALL_FLAGS = new Set([
  // shared npm / pnpm flags
  '-D', '--save-dev',
  '-O', '--save-optional',
  '-g', '--global',
  '--force', '-f',
  '--json',
  '--legacy-peer-deps',
  '--no-fund',
  '--no-audit',
  '--prefer-offline',
  '--frozen-lockfile',
  '--no-lockfile',
  // pnpm-specific flags
  '-P', '--save-peer',
  '-w', '--workspace-root',
  '-r', '--recursive',
  '--filter',
  '--no-optional',
  '--shamefully-hoist',
  '--strict-peer-dependencies',
]);

/**
 * Parses process.argv.slice(2) (the args after `node bin/cicurity.js`).
 *
 * Supported forms:
 *   cicurity install <pkg...>
 *   cicurity npm install <pkg...>
 *   cicurity pnpm add <pkg...>
 *   cicurity npx <pkg>
 */
export function parseArgs(argv: string[]): ParsedCommand {
  if (argv.length === 0) return { command: 'unknown', raw: argv };

  let tool: SupportedTool;
  let rest: string[];

  const first = argv[0] ?? '';

  if (first === 'npm' || first === 'pnpm' || first === 'npx') {
    tool = first;
    rest = argv.slice(1);
  } else if (first === 'install' || first === 'i' || first === 'add') {
    // `cicurity install <pkg>` - shorthand, defaults to npm
    tool = 'npm';
    rest = argv; // keep the subcommand in rest
  } else {
    return { command: 'unknown', raw: argv };
  }

  // For npx, there is no subcommand; the next token is the package
  const subcommand = tool === 'npx' ? '' : (rest[0] ?? '');
  const installSubcmds = INSTALL_SUBCOMMANDS[tool];

  if (!installSubcmds.has(subcommand)) {
    return { command: 'unknown', raw: argv };
  }

  // Everything after the subcommand (or after tool for npx)
  const afterSubcommand = tool === 'npx' ? rest : rest.slice(1);

  const packages: string[] = [];
  const passthroughArgs: string[] = tool === 'npx' ? [] : [subcommand];
  const flags = { json: false, force: false, saveDev: false, saveOptional: false, savePeer: false, global: false };
  let project: string | undefined;

  let doubleDashSeen = false;
  let i = 0;
  while (i < afterSubcommand.length) {
    const arg = afterSubcommand[i] ?? '';
    if (arg === '--') {
      doubleDashSeen = true;
      passthroughArgs.push(arg);
      i++;
      continue;
    }
    // --project <name> and -p <name>: consumed by cicurity, not passed through
    if (!doubleDashSeen && (arg === '--project' || arg === '-p')) {
      const val = afterSubcommand[i + 1];
      if (val !== undefined && !val.startsWith('-')) {
        project = val;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (!doubleDashSeen && INSTALL_FLAGS.has(arg)) {
      passthroughArgs.push(arg);
      if (arg === '--json') flags.json = true;
      if (arg === '--force' || arg === '-f') flags.force = true;
      if (arg === '-D' || arg === '--save-dev') flags.saveDev = true;
      if (arg === '-O' || arg === '--save-optional') flags.saveOptional = true;
      if (arg === '-P' || arg === '--save-peer') flags.savePeer = true;
      if (arg === '-g' || arg === '--global') flags.global = true;
      // --filter takes a value argument (pnpm workspace selector)
      if (arg === '--filter') {
        const val = afterSubcommand[i + 1];
        if (val !== undefined && !val.startsWith('-')) {
          passthroughArgs.push(val);
          i += 2;
          continue;
        }
      }
      i++;
      continue;
    }
    if (!doubleDashSeen && arg.startsWith('-')) {
      // Unknown flag - pass through but don't treat as a package name
      passthroughArgs.push(arg);
      i++;
      continue;
    }
    packages.push(arg);
    passthroughArgs.push(arg);
    i++;
  }

  return {
    command: 'install',
    tool,
    packages,
    passthroughArgs,
    flags,
    project,
  };
}
