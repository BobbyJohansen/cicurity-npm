// ANSI terminal color/style helpers and inline spinner.
// No dependencies - raw escape codes only.
const ESC = '\x1b[';
export const ansi = {
    reset: `${ESC}0m`,
    bold: (s) => `${ESC}1m${s}${ESC}0m`,
    dim: (s) => `${ESC}2m${s}${ESC}0m`,
    red: (s) => `${ESC}31m${s}${ESC}0m`,
    green: (s) => `${ESC}32m${s}${ESC}0m`,
    yellow: (s) => `${ESC}33m${s}${ESC}0m`,
    blue: (s) => `${ESC}34m${s}${ESC}0m`,
    cyan: (s) => `${ESC}36m${s}${ESC}0m`,
    white: (s) => `${ESC}37m${s}${ESC}0m`,
    gray: (s) => `${ESC}90m${s}${ESC}0m`,
    redBold: (s) => `${ESC}1;31m${s}${ESC}0m`,
    greenBold: (s) => `${ESC}1;32m${s}${ESC}0m`,
    yellowBold: (s) => `${ESC}1;33m${s}${ESC}0m`,
    /** Erase current line and move cursor to column 0 */
    clearLine: () => `${ESC}2K\r`,
};
/** Returns true if the current stdout supports color output. */
export function supportsColor() {
    return (process.stdout.isTTY === true &&
        process.env['NO_COLOR'] === undefined &&
        process.env['TERM'] !== 'dumb');
}
/** Conditionally applies an ANSI formatter based on supportsColor(). */
export function colorize(formatter, s) {
    return supportsColor() ? formatter(s) : s;
}
// ─── Spinner ─────────────────────────────────────────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/**
 * Starts an inline spinner on stdout. Returns a handle to stop it.
 * Falls back to a plain static message in non-TTY environments (CI).
 */
export function startSpinner(message) {
    if (!process.stdout.isTTY) {
        process.stdout.write(`${message}\n`);
        return { stop(final) { if (final)
                process.stdout.write(`${final}\n`); } };
    }
    let frame = 0;
    const interval = setInterval(() => {
        const spinner = SPINNER_FRAMES[frame % SPINNER_FRAMES.length] ?? '⠋';
        process.stdout.write(`${ansi.clearLine()}${colorize(ansi.cyan, spinner)} ${message}`);
        frame++;
    }, 80);
    return {
        stop(finalMessage) {
            clearInterval(interval);
            process.stdout.write(ansi.clearLine());
            if (finalMessage)
                process.stdout.write(`${finalMessage}\n`);
        },
    };
}
//# sourceMappingURL=ansi.js.map