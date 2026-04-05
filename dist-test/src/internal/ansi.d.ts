export declare const ansi: {
    reset: string;
    bold: (s: string) => string;
    dim: (s: string) => string;
    red: (s: string) => string;
    green: (s: string) => string;
    yellow: (s: string) => string;
    blue: (s: string) => string;
    cyan: (s: string) => string;
    white: (s: string) => string;
    gray: (s: string) => string;
    redBold: (s: string) => string;
    greenBold: (s: string) => string;
    yellowBold: (s: string) => string;
    /** Erase current line and move cursor to column 0 */
    clearLine: () => string;
};
/** Returns true if the current stdout supports color output. */
export declare function supportsColor(): boolean;
/** Conditionally applies an ANSI formatter based on supportsColor(). */
export declare function colorize(formatter: (s: string) => string, s: string): string;
export interface Spinner {
    stop(finalMessage?: string): void;
}
/**
 * Starts an inline spinner on stdout. Returns a handle to stop it.
 * Falls back to a plain static message in non-TTY environments (CI).
 */
export declare function startSpinner(message: string): Spinner;
//# sourceMappingURL=ansi.d.ts.map