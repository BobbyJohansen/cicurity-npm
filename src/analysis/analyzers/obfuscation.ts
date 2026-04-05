// Detects code obfuscation in install scripts.
// Canonical supply chain attack pattern: eval(Buffer.from(payload, 'base64').toString())

import type { AnalysisContext, Finding } from '../types.js';
import { parseScript, walkAst, shannonEntropy, type AcornNode } from '../ast-utils.js';

/** Minimum string length to check entropy on (avoids noise from short strings) */
const ENTROPY_MIN_LENGTH = 100;
/** Shannon entropy threshold for base64/hex blobs */
const HIGH_ENTROPY_THRESHOLD = 4.5;

export function analyzeObfuscation(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];

  for (const script of context.installScripts) {
    if (!script.source) continue;

    const src = script.source;
    const fileRef = script.resolvedFile ?? `[${script.lifecycle}]`;

    const ast = parseScript(src, script.resolvedFile);

    // ── 1. AST-based: eval() and new Function() ────────────────────────────

    if (ast) {
      walkAst(ast, (node: AcornNode) => {
        // eval(...)
        if (
          node.type === 'CallExpression' &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'eval'
        ) {
          const arg = node.arguments?.[0];
          const evidence = arg ? sliceSource(src, arg) : 'eval(...)';
          findings.push({
            category: 'install-script-eval',
            level: 'critical',
            title: 'eval() in install script',
            description: `The ${script.lifecycle} script uses eval() to execute dynamic code. This is a primary technique for hiding malicious payloads.`,
            evidence,
            file: fileRef,
            line: node.loc?.start.line,
          });
        }

        // new Function(...)
        if (
          node.type === 'NewExpression' &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'Function'
        ) {
          findings.push({
            category: 'install-script-eval',
            level: 'critical',
            title: 'new Function() in install script',
            description: `The ${script.lifecycle} script uses \`new Function()\` to execute dynamic code — equivalent to eval().`,
            evidence: sliceSource(src, node).slice(0, 200),
            file: fileRef,
            line: node.loc?.start.line,
          });
        }

        // Buffer.from(x, 'base64') — potential payload decoding
        if (isBufferFromBase64(node)) {
          findings.push({
            category: 'install-script-obfuscation',
            level: 'high',
            title: 'Base64 decoding in install script',
            description: `The ${script.lifecycle} script decodes base64 data at install time. Combined with eval(), this is the canonical supply chain attack pattern.`,
            evidence: sliceSource(src, node).slice(0, 200),
            file: fileRef,
            line: node.loc?.start.line,
          });
        }

        // atob() or btoa() — another base64 path
        if (
          node.type === 'CallExpression' &&
          node.callee?.type === 'Identifier' &&
          (node.callee.name === 'atob' || node.callee.name === 'btoa')
        ) {
          findings.push({
            category: 'install-script-obfuscation',
            level: 'high',
            title: `${node.callee.name}() in install script`,
            description: `The ${script.lifecycle} script uses ${node.callee.name}() for base64 encoding/decoding.`,
            evidence: sliceSource(src, node).slice(0, 200),
            file: fileRef,
            line: node.loc?.start.line,
          });
        }

        // vm.runInNewContext / vm.runInThisContext — dynamic code execution
        if (isVmRunCall(node)) {
          findings.push({
            category: 'install-script-eval',
            level: 'critical',
            title: 'vm.run*() in install script',
            description: `The ${script.lifecycle} script uses the Node.js vm module to execute code in a new context.`,
            evidence: sliceSource(src, node).slice(0, 200),
            file: fileRef,
            line: node.loc?.start.line,
          });
        }
      });
    } else {
      // AST parse failed — code may be intentionally obfuscated
      findings.push({
        category: 'install-script-obfuscation',
        level: 'high',
        title: 'Install script could not be parsed',
        description: `The ${script.lifecycle} script failed to parse. It may be intentionally obfuscated or minified.`,
        file: fileRef,
      });
    }

    // ── 2. Regex-based: high-entropy string literals ───────────────���───────

    // Check for long strings with high entropy (base64/hex encoded payloads)
    const stringMatches = src.matchAll(/["'`]([A-Za-z0-9+/=]{100,})["'`]/g);
    for (const match of stringMatches) {
      const s = match[1] ?? '';
      if (shannonEntropy(s) > HIGH_ENTROPY_THRESHOLD) {
        findings.push({
          category: 'install-script-obfuscation',
          level: 'high',
          title: 'High-entropy string literal in install script',
          description: `The ${script.lifecycle} script contains a high-entropy string (likely base64/hex encoded data) that may be an embedded payload.`,
          evidence: s.slice(0, 80) + '…',
          file: fileRef,
        });
        break; // One finding per script is enough to signal the issue
      }
    }

    // ── 3. Regex-based: hex escape sequences (\\xNN obfuscation) ─────────

    const hexObfuscated = /(?:\\x[0-9a-fA-F]{2}){8,}/.test(src);
    if (hexObfuscated) {
      findings.push({
        category: 'install-script-obfuscation',
        level: 'high',
        title: 'Hex-escaped string obfuscation in install script',
        description: `The ${script.lifecycle} script contains sequences of \\xNN hex escapes, a common obfuscation technique.`,
        file: fileRef,
      });
    }
  }

  return findings;
}

function isBufferFromBase64(node: AcornNode): boolean {
  // Buffer.from(x, 'base64')
  return (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'Buffer' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'from' &&
    node.arguments?.length === 2 &&
    node.arguments[1]?.type === 'Literal' &&
    node.arguments[1].value === 'base64'
  );
}

function isVmRunCall(node: AcornNode): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'vm' &&
    node.callee.property?.type === 'Identifier' &&
    typeof node.callee.property.name === 'string' &&
    node.callee.property.name.startsWith('runIn')
  );
}

function sliceSource(source: string, node: AcornNode): string {
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    return source.slice(node.start, Math.min(node.end, node.start + 200));
  }
  return '';
}
