// Interactive yes/no/abort prompt using node:readline.
// Only used in TTY mode; CI always gets non-interactive behaviour.
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { colorize, ansi } from './ansi.js';
/**
 * Asks the user a yes/no question on the terminal.
 * Returns 'yes' if they confirm, 'no' otherwise.
 * In non-TTY environments always returns 'no' (safe default).
 */
export async function confirm(question) {
    if (!process.stdin.isTTY)
        return 'no';
    const rl = readline.createInterface({ input, output });
    try {
        const prompt = colorize(ansi.yellowBold, '?') + ` ${question} ${colorize(ansi.gray, '[y/N]')} `;
        const answer = await rl.question(prompt);
        return answer.trim().toLowerCase() === 'y' ? 'yes' : 'no';
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=prompt.js.map