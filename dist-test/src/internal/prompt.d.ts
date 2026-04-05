export type PromptChoice = 'yes' | 'no';
/**
 * Asks the user a yes/no question on the terminal.
 * Returns 'yes' if they confirm, 'no' otherwise.
 * In non-TTY environments always returns 'no' (safe default).
 */
export declare function confirm(question: string): Promise<PromptChoice>;
//# sourceMappingURL=prompt.d.ts.map