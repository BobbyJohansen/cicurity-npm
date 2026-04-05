// CLI argument parser - no commander dependency.
// Handles all cicurity invocation styles.
/** Subcommand aliases that mean "install packages" for each tool */
const INSTALL_SUBCOMMANDS = {
    npm: new Set(['install', 'i', 'add', 'isntall']),
    pnpm: new Set(['install', 'i', 'add']),
    npx: new Set(['exec', 'x', '']), // npx <pkg> has no explicit subcommand
};
const INSTALL_FLAGS = new Set([
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
export function parseArgs(argv) {
    if (argv.length === 0)
        return { command: 'unknown', raw: argv };
    let tool;
    let rest;
    const first = argv[0] ?? '';
    if (first === 'npm' || first === 'pnpm' || first === 'npx') {
        tool = first;
        rest = argv.slice(1);
    }
    else if (first === 'install' || first === 'i' || first === 'add') {
        // `cicurity install <pkg>` - shorthand, defaults to npm
        tool = 'npm';
        rest = argv; // keep the subcommand in rest
    }
    else {
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
    const packages = [];
    const passthroughArgs = tool === 'npx' ? [] : [subcommand];
    const flags = { json: false, force: false, saveDev: false, saveOptional: false, global: false };
    let doubleDashSeen = false;
    for (const arg of afterSubcommand) {
        if (arg === '--') {
            doubleDashSeen = true;
            passthroughArgs.push(arg);
            continue;
        }
        if (!doubleDashSeen && INSTALL_FLAGS.has(arg)) {
            passthroughArgs.push(arg);
            if (arg === '--json')
                flags.json = true;
            if (arg === '--force' || arg === '-f')
                flags.force = true;
            if (arg === '-D' || arg === '--save-dev')
                flags.saveDev = true;
            if (arg === '-O' || arg === '--save-optional')
                flags.saveOptional = true;
            if (arg === '-g' || arg === '--global')
                flags.global = true;
            continue;
        }
        if (!doubleDashSeen && arg.startsWith('-')) {
            // Unknown flag - pass through but don't treat as a package name
            passthroughArgs.push(arg);
            continue;
        }
        packages.push(arg);
        passthroughArgs.push(arg);
    }
    return {
        command: 'install',
        tool,
        packages,
        passthroughArgs,
        flags,
    };
}
//# sourceMappingURL=args.js.map