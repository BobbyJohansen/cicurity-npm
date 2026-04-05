import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildReport } from '../../../src/cli/output/report.js';
function makeResult(overrides = {}) {
    return {
        packageName: 'express',
        version: '4.18.2',
        integrity: 'sha512-abc123',
        findings: [],
        score: { total: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
        action: 'allow',
        durationMs: 100,
        ...overrides,
    };
}
function makeResolved(name, version, publishedAt) {
    return {
        name,
        version,
        tarballUrl: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        integrity: 'sha512-abc123',
        packument: {
            name,
            'dist-tags': { latest: version },
            versions: {},
            time: publishedAt ? { [version]: publishedAt } : {},
            maintainers: [],
        },
    };
}
describe('buildReport', () => {
    it('summary counts are correct', () => {
        const results = [
            makeResult({ action: 'block', packageName: 'evil', score: { total: 90, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 } }),
            makeResult({ action: 'warn', packageName: 'risky', score: { total: 20, criticalCount: 0, highCount: 1, mediumCount: 1, lowCount: 0 } }),
            makeResult({ action: 'allow', packageName: 'safe' }),
        ];
        const report = buildReport(results, new Map(), 'my-project');
        assert.equal(report.summary.total, 3);
        assert.equal(report.summary.blocked, 1);
        assert.equal(report.summary.warned, 1);
        assert.equal(report.summary.clean, 1);
    });
    it('all packages appear in packages array regardless of state', () => {
        const results = [
            makeResult({ action: 'block', packageName: 'evil' }),
            makeResult({ action: 'allow', packageName: 'safe' }),
        ];
        const report = buildReport(results, new Map(), 'my-project');
        assert.equal(report.packages.length, 2);
    });
    it('maps action allow to state clean', () => {
        const report = buildReport([makeResult({ action: 'allow' })], new Map(), 'p');
        assert.equal(report.packages[0]?.state, 'clean');
    });
    it('maps action warn to state warn', () => {
        const report = buildReport([makeResult({ action: 'warn' })], new Map(), 'p');
        assert.equal(report.packages[0]?.state, 'warn');
    });
    it('maps action block to state block', () => {
        const report = buildReport([makeResult({ action: 'block' })], new Map(), 'p');
        assert.equal(report.packages[0]?.state, 'block');
    });
    it('populates publishedAt from packument time', () => {
        const result = makeResult({ action: 'block', packageName: 'express', version: '4.18.2' });
        const resolved = makeResolved('express', '4.18.2', '2023-01-15T00:00:00.000Z');
        const map = new Map([['express@4.18.2', resolved]]);
        const report = buildReport([result], map, 'p');
        assert.equal(report.packages[0]?.publishedAt, '2023-01-15T00:00:00.000Z');
    });
    it('sets publishedAt to null when version absent from packument time', () => {
        const result = makeResult({ action: 'warn', packageName: 'pkg', version: '1.0.0' });
        const report = buildReport([result], new Map(), 'p');
        assert.equal(report.packages[0]?.publishedAt, null);
    });
    it('block recommendation text is correct', () => {
        const result = makeResult({
            action: 'block',
            score: { total: 45, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 },
        });
        const report = buildReport([result], new Map(), 'p');
        assert.equal(report.packages[0]?.recommendation, 'Block installation (score 45/100 with 1 critical and 0 high finding(s)).');
    });
    it('warn recommendation text is correct', () => {
        const result = makeResult({
            action: 'warn',
            score: { total: 30, criticalCount: 0, highCount: 2, mediumCount: 1, lowCount: 0 },
        });
        const report = buildReport([result], new Map(), 'p');
        assert.equal(report.packages[0]?.recommendation, 'Review before installing (score 30/100 with 2 high and 1 medium finding(s)).');
    });
    it('clean recommendation text is correct', () => {
        const result = makeResult({ action: 'allow' });
        const report = buildReport([result], new Map(), 'p');
        assert.equal(report.packages[0]?.recommendation, 'No issues detected.');
    });
    it('uses the provided project name', () => {
        const report = buildReport([], new Map(), 'my-app');
        assert.equal(report.projectName, 'my-app');
    });
    it('has a valid ISO timestamp', () => {
        const report = buildReport([], new Map(), 'p');
        assert.ok(!isNaN(Date.parse(report.timestamp)));
    });
    it('all-clean run produces report with all packages present', () => {
        const results = [
            makeResult({ action: 'allow', packageName: 'a' }),
            makeResult({ action: 'allow', packageName: 'b' }),
        ];
        const report = buildReport(results, new Map(), 'p');
        assert.equal(report.packages.length, 2);
        assert.equal(report.summary.clean, 2);
        assert.equal(report.summary.blocked, 0);
        assert.equal(report.summary.warned, 0);
    });
});
//# sourceMappingURL=report.test.js.map