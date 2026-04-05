// CLI entry point - parses arguments and dispatches to commands.
import { parseArgs } from '../internal/args.js';
import { runInstall } from './commands/install.js';
import { ansi, colorize } from '../internal/ansi.js';
const VERSION = '0.1.0';
const USAGE = `
${colorize(ansi.bold, 'cicurity')} - npm supply chain attack prevention

${colorize(ansi.bold, 'Usage:')}
  cicurity install <pkg...>
  cicurity npm install <pkg...>
  cicurity pnpm add <pkg...>
  cicurity npx <pkg>

${colorize(ansi.bold, 'Examples:')}
  cicurity install express lodash
  cicurity npm install --save-dev typescript
  cicurity pnpm add react react-dom
  cicurity npx create-react-app myapp

${colorize(ansi.bold, 'Flags:')}
  --json       Machine-readable JSON output (useful in CI)
  --force      Override a blocked install (use with care)
  -h, --help   Show this help
  -v, --version Show version

${colorize(ansi.bold, 'Config:')}
  Create cicurity.config.json in your project root to configure allowlists and thresholds.
`.trim();
async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
        process.stdout.write(USAGE + '\n');
        process.exit(0);
    }
    if (argv[0] === '--version' || argv[0] === '-v') {
        process.stdout.write(`cicurity ${VERSION}\n`);
        process.exit(0);
    }
    const parsed = parseArgs(argv);
    if (parsed.command === 'unknown') {
        // Pass through unknown commands directly to the underlying tool
        // e.g. `cicurity npm audit` - we don't intercept non-install commands
        const tool = argv[0];
        if (tool === 'npm' || tool === 'pnpm' || tool === 'npx') {
            const { spawnSync } = await import('node:child_process');
            const result = spawnSync(tool, argv.slice(1), { stdio: 'inherit', shell: false });
            process.exit(result.status ?? 0);
        }
        process.stderr.write(`cicurity: unknown command '${argv.join(' ')}'\n${USAGE}\n`);
        process.exit(1);
    }
    if (parsed.command === 'install') {
        // --force bypasses cicurity analysis (escape hatch)
        if (parsed.flags.force) {
            process.stderr.write(colorize(ansi.yellow, '⚠ --force: skipping cicurity analysis\n'));
            const { spawnSync } = await import('node:child_process');
            const result = spawnSync(parsed.tool, parsed.passthroughArgs, { stdio: 'inherit', shell: false });
            process.exit(result.status ?? 0);
        }
        await runInstall(parsed);
    }
}
main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`cicurity: unhandled error: ${msg}\n`);
    if (process.env['DEBUG']) {
        console.error(err);
    }
    process.exit(1);
});
//# sourceMappingURL=index.js.map