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
/**
 * Parses process.argv.slice(2) (the args after `node bin/cicurity.js`).
 *
 * Supported forms:
 *   cicurity install <pkg...>
 *   cicurity npm install <pkg...>
 *   cicurity pnpm add <pkg...>
 *   cicurity npx <pkg>
 */
export declare function parseArgs(argv: string[]): ParsedCommand;
//# sourceMappingURL=args.d.ts.map