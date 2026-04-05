// Tarball extractor using node:zlib (gunzip) + manual tar header parsing.
// No external dependencies — the tar format is a fixed 512-byte header spec.
//
// Supports: gzipped tarballs (.tgz / .tar.gz), standard POSIX tar headers,
// GNU longname/longlink extensions (type '1'/'2' handled as skips),
// POSIX pax extended headers (type 'x'/'g' ignored — name falls back to header).
//
// Does NOT support: POSIX ACL extensions, sparse files, hard links.
// These are not used by npm package tarballs.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import * as stream from 'node:stream';
const BLOCK = 512;
/** Parse a 512-byte tar header block. Returns null for empty (zero) blocks. */
function parseHeader(block) {
    // Zero block = end-of-archive marker
    if (block.every((b) => b === 0))
        return null;
    const name = readString(block, 0, 100);
    const prefix = readString(block, 345, 155);
    const typeflag = String.fromCharCode(block[156] ?? 0);
    const sizeOctal = readString(block, 124, 12);
    const size = parseInt(sizeOctal.trim(), 8) || 0;
    const fullName = prefix ? `${prefix}/${name}` : name;
    return { name: fullName, typeflag, size, dest: fullName };
}
function readString(buf, offset, length) {
    const slice = buf.subarray(offset, offset + length);
    const nullIdx = slice.indexOf(0);
    return slice.subarray(0, nullIdx === -1 ? length : nullIdx).toString('utf8');
}
/** Round size up to the nearest 512-byte block boundary. */
function paddedSize(size) {
    return Math.ceil(size / BLOCK) * BLOCK;
}
/**
 * Extracts a gzipped tar archive to destDir.
 * Only extracts regular files; skips directories (creates them as needed),
 * symlinks, and special entries.
 *
 * @param tgzPath  Absolute path to the .tgz file
 * @param destDir  Absolute path to the extraction destination directory
 * @returns List of extracted file paths (relative to destDir)
 */
export async function extractTarball(tgzPath, destDir) {
    const extracted = [];
    await fs.promises.mkdir(destDir, { recursive: true });
    const fileStream = fs.createReadStream(tgzPath);
    const gunzip = zlib.createGunzip();
    const piped = fileStream.pipe(gunzip);
    await new Promise((resolve, reject) => {
        piped.on('error', reject);
        fileStream.on('error', reject);
        // Accumulate raw decompressed bytes
        const chunks = [];
        piped.on('data', (chunk) => chunks.push(chunk));
        piped.on('end', () => {
            try {
                const data = Buffer.concat(chunks);
                let offset = 0;
                let paxName = null; // pax extended header override
                while (offset + BLOCK <= data.length) {
                    const headerBlock = data.subarray(offset, offset + BLOCK);
                    offset += BLOCK;
                    const header = parseHeader(headerBlock);
                    if (!header)
                        break; // end-of-archive
                    const dataSize = header.size;
                    const dataBlock = data.subarray(offset, offset + dataSize);
                    offset += paddedSize(dataSize);
                    const typeflag = header.typeflag;
                    // pax extended header — extract name override, then skip data
                    if (typeflag === 'x' || typeflag === 'X') {
                        paxName = parsePaxName(dataBlock);
                        continue;
                    }
                    // GNU long name — read name from data, apply to next header
                    if (typeflag === 'L') {
                        paxName = dataBlock.toString('utf8').replace(/\0/g, '').trim();
                        continue;
                    }
                    const entryName = paxName ?? header.name;
                    paxName = null;
                    // Directory entries — just ensure the dir exists
                    if (typeflag === '5' || entryName.endsWith('/')) {
                        const dirPath = safeJoin(destDir, entryName.replace(/\/$/, ''));
                        if (dirPath !== null) {
                            fs.mkdirSync(dirPath, { recursive: true });
                        }
                        continue;
                    }
                    // Skip symlinks and other special types
                    if (typeflag !== '0' && typeflag !== '' && typeflag !== '\0') {
                        continue;
                    }
                    // Regular file
                    const destPath = safeJoin(destDir, entryName);
                    if (destPath === null)
                        continue; // path traversal attempt — skip
                    fs.mkdirSync(path.dirname(destPath), { recursive: true });
                    fs.writeFileSync(destPath, dataBlock);
                    extracted.push(path.relative(destDir, destPath));
                }
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    });
    return extracted;
}
/**
 * Safely joins destDir and entryName, rejecting any path that would
 * escape outside destDir (path traversal prevention).
 */
function safeJoin(destDir, entryName) {
    // Strip leading slashes and normalise
    const clean = path.normalize(entryName.replace(/^(\.\.[\\/])+/, ''));
    const resolved = path.resolve(destDir, clean);
    if (!resolved.startsWith(path.resolve(destDir) + path.sep) &&
        resolved !== path.resolve(destDir)) {
        return null;
    }
    return resolved;
}
/** Parse a pax extended header block to extract the 'path' field if present. */
function parsePaxName(block) {
    const text = block.toString('utf8');
    for (const line of text.split('\n')) {
        // Format: "<length> <key>=<value>\n"
        const match = /^\d+ path=(.+)$/.exec(line.trim());
        if (match?.[1])
            return match[1];
    }
    return null;
}
/**
 * Convenience: pipe a readable stream to disk, then extract.
 * Used by tarball/fetcher.ts to write the download and extract in two steps.
 */
export async function writeStream(readable, destPath) {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const writer = fs.createWriteStream(destPath);
    await stream.promises.pipeline(readable, writer);
}
//# sourceMappingURL=tar.js.map