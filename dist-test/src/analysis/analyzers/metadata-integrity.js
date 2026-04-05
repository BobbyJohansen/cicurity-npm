// Detects suspicious metadata changes between the current and previous package version.
// After account takeover, attackers often: add lifecycle scripts, remove repository fields,
// change the author, or modify homepage to their own server.
/** Lifecycle hook names that can execute code at install time */
const INSTALL_HOOKS = new Set(['preinstall', 'install', 'postinstall', 'prepare', 'prepack']);
export function analyzeMetadataIntegrity(context) {
    const findings = [];
    const { packument, packageName, version } = context;
    const versions = Object.keys(packument.versions).sort(compareSemverSimple);
    const currentIdx = versions.indexOf(version);
    // No previous version to compare against
    if (currentIdx <= 0)
        return findings;
    const previousVersion = versions[currentIdx - 1];
    if (!previousVersion)
        return findings;
    const current = packument.versions[version];
    const previous = packument.versions[previousVersion];
    if (!current || !previous)
        return findings;
    // --- New lifecycle hooks added ---
    const prevHooks = new Set(Object.keys(previous.scripts ?? {}).filter((k) => INSTALL_HOOKS.has(k)));
    const currHooks = new Set(Object.keys(current.scripts ?? {}).filter((k) => INSTALL_HOOKS.has(k)));
    for (const hook of currHooks) {
        if (!prevHooks.has(hook)) {
            const hookCmd = current.scripts?.[hook] ?? '';
            findings.push({
                category: 'metadata-integrity',
                level: 'critical',
                title: `New lifecycle hook '${hook}' added in version ${version}`,
                description: `Version ${version} of '${packageName}' adds a new '${hook}' script that was absent in ${previousVersion}. ` +
                    'Lifecycle hooks run at install time with the installer\'s full permissions. ' +
                    'Adding a new hook after a long stable period is a primary indicator of account takeover.',
                evidence: `${hook}: ${hookCmd.slice(0, 150)}`,
            });
        }
    }
    // --- repository field removed ---
    const prevRepo = getRepoUrl(previous);
    const currRepo = getRepoUrl(current);
    if (prevRepo && !currRepo) {
        findings.push({
            category: 'metadata-integrity',
            level: 'high',
            title: `Repository field removed in version ${version}`,
            description: `Version ${version} of '${packageName}' no longer has a repository URL, but ${previousVersion} pointed to '${prevRepo}'. ` +
                'Removing the repository field after account takeover reduces traceability and makes the package ' +
                'harder to audit.',
            evidence: `Previous: ${prevRepo} | Current: (none)`,
        });
    }
    // --- author changed ---
    const prevAuthor = normalizeAuthor(previous);
    const currAuthor = normalizeAuthor(current);
    if (prevAuthor && currAuthor && prevAuthor !== currAuthor) {
        findings.push({
            category: 'metadata-integrity',
            level: 'high',
            title: `Package author changed: '${prevAuthor}' → '${currAuthor}'`,
            description: `The author field of '${packageName}' changed between ${previousVersion} and ${version}. ` +
                'An author change combined with other signals (new lifecycle hook, removed repo) strongly suggests account takeover.',
            evidence: `${previousVersion}: ${prevAuthor} | ${version}: ${currAuthor}`,
        });
    }
    // --- homepage changed to a different domain ---
    const prevHomepage = getHostname(getFieldString(previous, 'homepage'));
    const currHomepage = getHostname(getFieldString(current, 'homepage'));
    if (prevHomepage && currHomepage && prevHomepage !== currHomepage) {
        findings.push({
            category: 'metadata-integrity',
            level: 'medium',
            title: `Homepage domain changed: '${prevHomepage}' → '${currHomepage}'`,
            description: `The homepage URL domain of '${packageName}' changed between ${previousVersion} and ${version}. ` +
                'Changing the homepage to an attacker-controlled domain can be used to redirect users or track installs.',
            evidence: `${previousVersion}: ${getFieldString(previous, 'homepage') ?? ''} | ${version}: ${getFieldString(current, 'homepage') ?? ''}`,
        });
    }
    return findings;
}
function getRepoUrl(meta) {
    const repo = meta['repository'];
    if (!repo)
        return null;
    if (typeof repo === 'string')
        return repo;
    if (typeof repo === 'object' && repo !== null) {
        const r = repo;
        return typeof r['url'] === 'string' ? r['url'] : null;
    }
    return null;
}
function normalizeAuthor(meta) {
    const author = meta['author'];
    if (!author)
        return null;
    if (typeof author === 'string')
        return author.trim();
    if (typeof author === 'object' && author !== null) {
        const a = author;
        const name = typeof a['name'] === 'string' ? a['name'] : '';
        const email = typeof a['email'] === 'string' ? a['email'] : '';
        return `${name} <${email}>`.trim();
    }
    return null;
}
function getFieldString(meta, field) {
    const val = meta[field];
    return typeof val === 'string' ? val : null;
}
function getHostname(url) {
    if (!url)
        return null;
    try {
        return new URL(url).hostname;
    }
    catch {
        return null;
    }
}
function compareSemverSimple(a, b) {
    const pa = a.replace(/^[v=]/, '').split('.').map(Number);
    const pb = b.replace(/^[v=]/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
//# sourceMappingURL=metadata-integrity.js.map