import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { scoreFindings, applyEnvironmentOverride } from '../../../src/analysis/scoring.js';
function finding(level) {
    return {
        category: 'install-script-network',
        level,
        title: 'test',
        description: 'test',
    };
}
describe('scoreFindings', () => {
    it('returns allow for empty findings', () => {
        const { score, action } = scoreFindings([]);
        assert.equal(action, 'allow');
        assert.equal(score.total, 0);
    });
    it('blocks on a single critical finding', () => {
        const { action } = scoreFindings([finding('critical')]);
        assert.equal(action, 'block');
    });
    it('warns on a single high finding', () => {
        const { action } = scoreFindings([finding('high')]);
        assert.equal(action, 'warn');
    });
    it('warns when score reaches 10 via medium findings', () => {
        // 2 medium findings = 10 points
        const { action } = scoreFindings([finding('medium'), finding('medium')]);
        assert.equal(action, 'warn');
    });
    it('allows with score < 10 and no critical/high', () => {
        const { action } = scoreFindings([finding('low'), finding('low')]);
        assert.equal(action, 'allow');
    });
    it('caps score at 100', () => {
        const manyFindings = Array.from({ length: 10 }, () => finding('critical'));
        const { score } = scoreFindings(manyFindings);
        assert.equal(score.total, 100);
    });
    it('counts findings by level', () => {
        const findings = [
            finding('critical'), finding('critical'),
            finding('high'),
            finding('medium'), finding('medium'), finding('medium'),
        ];
        const { score } = scoreFindings(findings);
        assert.equal(score.criticalCount, 2);
        assert.equal(score.highCount, 1);
        assert.equal(score.mediumCount, 3);
    });
});
describe('applyEnvironmentOverride', () => {
    const originalEnv = { ...process.env };
    it('leaves block unchanged in CI', () => {
        process.env['CI'] = 'true';
        assert.equal(applyEnvironmentOverride('block'), 'block');
        process.env = { ...originalEnv };
    });
    it('escalates warn to block in CI by default', () => {
        process.env['CI'] = 'true';
        assert.equal(applyEnvironmentOverride('warn'), 'block');
        process.env = { ...originalEnv };
    });
    it('respects warnAction=warn in CI', () => {
        process.env['CI'] = 'true';
        assert.equal(applyEnvironmentOverride('warn', 'warn'), 'warn');
        process.env = { ...originalEnv };
    });
    it('does not escalate warn outside CI', () => {
        delete process.env['CI'];
        delete process.env['GITHUB_ACTIONS'];
        assert.equal(applyEnvironmentOverride('warn'), 'warn');
    });
    it('leaves allow unchanged', () => {
        assert.equal(applyEnvironmentOverride('allow'), 'allow');
    });
});
//# sourceMappingURL=scoring.test.js.map