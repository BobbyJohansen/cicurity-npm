// Detects prebuilt binary files in npm packages.
// Binaries are harder to audit and a common vector for backdoors.
import * as fs from 'node:fs';
import * as path from 'node:path';
/** File extensions that indicate prebuilt binaries */
const BINARY_EXTENSIONS = new Set([
    '.node', // Native Node.js addon
    '.so', // Linux shared library
    '.dylib', // macOS dynamic library
    '.dll', // Windows DLL
    '.exe', // Windows executable
    '.out', // Linux ELF executable
    '.elf', // ELF binary
]);
/** Magic bytes for common binary formats */
const MAGIC_BYTES = [
    { name: 'ELF binary (Linux)', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // \x7fELF
    { name: 'PE executable (Windows)', bytes: [0x4d, 0x5a] }, // MZ
    { name: 'Mach-O binary (macOS 64-bit)', bytes: [0xcf, 0xfa, 0xed, 0xfe] }, // FEEDFACF
    { name: 'Mach-O binary (macOS 32-bit)', bytes: [0xce, 0xfa, 0xed, 0xfe] }, // FEEDFACE
];
/** Read the first N bytes of a file */
async function readMagicBytes(filePath, count) {
    let fd = null;
    try {
        fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(count);
        const { bytesRead } = await fd.read(buf, 0, count, 0);
        return buf.subarray(0, bytesRead);
    }
    catch {
        return null;
    }
    finally {
        await fd?.close().catch(() => undefined);
    }
}
function detectMagicBytes(buf) {
    for (const { name, bytes } of MAGIC_BYTES) {
        if (bytes.every((b, i) => buf[i] === b))
            return name;
    }
    return null;
}
export async function analyzeBinaryFiles(context) {
    const findings = [];
    for (const relFile of context.allFiles) {
        const ext = path.extname(relFile).toLowerCase();
        const absPath = path.join(context.extractedPath, relFile);
        if (BINARY_EXTENSIONS.has(ext)) {
            findings.push({
                category: 'binary-files',
                level: 'medium',
                title: `Prebuilt binary file: ${path.basename(relFile)}`,
                description: `The package includes a prebuilt binary (${ext}) which cannot be statically analyzed for malicious code. ` +
                    'Prebuilt binaries are a common vector for backdoors in supply chain attacks.',
                file: relFile,
            });
            continue;
        }
        // For files without a suspicious extension, check magic bytes
        // (attackers sometimes rename binaries to .js or omit extension)
        if (ext === '' || ext === '.js' || ext === '.bin') {
            const magic = await readMagicBytes(absPath, 4);
            if (magic && magic.length >= 2) {
                const detected = detectMagicBytes(magic);
                if (detected) {
                    findings.push({
                        category: 'binary-files',
                        level: 'high',
                        title: `Disguised binary file: ${path.basename(relFile)}`,
                        description: `The file '${relFile}' appears to be a ${detected} despite its extension. ` +
                            'This is a technique used to hide malicious executables in packages.',
                        evidence: `Magic bytes: ${Array.from(magic.subarray(0, 4)).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`,
                        file: relFile,
                    });
                }
            }
        }
    }
    return findings;
}
//# sourceMappingURL=binary-files.js.map