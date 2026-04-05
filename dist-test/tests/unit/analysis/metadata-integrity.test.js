import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeMetadataIntegrity } from '../../../src/analysis/analyzers/metadata-integrity.js';
function makeVersion(overrides = {}) {
    return {
        name: 'test-pkg',
        version: '1.0.0',
        dist: { integrity: 'sha512-abc', tarball: 'https://registry.npmjs.org/test-pkg/-/test-pkg-1.0.0.tgz' },
        maintainers: [],
        ...overrides,
    };
}
function makePackument(v1Meta, v2Meta) {
    return {
        name: 'test-pkg',
        'dist-tags': { latest: '1.0.1' },
        versions: {
            '1.0.0': makeVersion({ ...v1Meta, version: '1.0.0' }),
            '1.0.1': makeVersion({ ...v2Meta, version: '1.0.1' }),
        },
        time: {
            created: '2024-01-01T00:00:00.000Z',
            '1.0.0': '2024-01-01T00:00:00.000Z',
            '1.0.1': '2024-06-01T00:00:00.000Z',
        },
        maintainers: [],
    };
}
function makeContext(packument, version) {
    return {
        packageName: 'test-pkg',
        version,
        extractedPath: '/tmp/fake',
        allFiles: [],
        installScripts: [],
        packument,
    };
}
describe('analyzeMetadataIntegrity', () => {
    it('detects new postinstall hook added as critical', () => {
        const packument = makePackument({ scripts: { build: 'tsc' } }, { scripts: { build: 'tsc', postinstall: 'node evil.js' } });
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.1'));
        assert.ok(findings.some((f) => f.category === 'metadata-integrity' && f.level === 'critical'));
    });
    it('detects preinstall hook added as critical', () => {
        const packument = makePackument({ scripts: {} }, { scripts: { preinstall: 'node payload.js' } });
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.1'));
        assert.ok(findings.some((f) => f.category === 'metadata-integrity' && f.level === 'critical'));
    });
    it('detects repository field removed as high', () => {
        const packument = makePackument({ scripts: {} }, { scripts: {} });
        // Manually inject repository into the first version only (not in VersionMetadata type)
        packument.versions['1.0.0']['repository'] = {
            type: 'git',
            url: 'https://github.com/foo/bar.git',
        };
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.1'));
        assert.ok(findings.some((f) => f.category === 'metadata-integrity' && f.level === 'high' && f.title.toLowerCase().includes('repository')));
    });
    it('detects author change as high', () => {
        const packument = makePackument({ scripts: {} }, { scripts: {} });
        packument.versions['1.0.0']['author'] = { name: 'Alice', email: 'alice@example.com' };
        packument.versions['1.0.1']['author'] = { name: 'attacker', email: 'attacker@evil.io' };
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.1'));
        assert.ok(findings.some((f) => f.category === 'metadata-integrity' && f.level === 'high' && f.title.includes('author')));
    });
    it('does not flag when no changes between versions', () => {
        const packument = makePackument({ scripts: { build: 'tsc' } }, { scripts: { build: 'tsc' } });
        const repo = { type: 'git', url: 'https://github.com/foo/bar.git' };
        packument.versions['1.0.0']['repository'] = repo;
        packument.versions['1.0.1']['repository'] = repo;
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.1'));
        assert.equal(findings.length, 0);
    });
    it('returns empty for first-ever version (no previous)', () => {
        const packument = {
            name: 'brand-new',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': makeVersion({ version: '1.0.0' }) },
            time: { created: new Date().toISOString(), '1.0.0': new Date().toISOString() },
            maintainers: [],
        };
        const findings = analyzeMetadataIntegrity(makeContext(packument, '1.0.0'));
        assert.equal(findings.length, 0);
    });
});
//# sourceMappingURL=metadata-integrity.test.js.map