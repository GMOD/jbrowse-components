// Derives each listed package's `publishConfig.exports` from the `exports` map
// it already declares, so the surface a third party installs is the same one
// the workspace enforces.
//
// The two maps say the same thing about different trees — `./src/x.ts` in the
// workspace, `./esm/x.js` in the tarball — and only the second one is what an
// external plugin actually resolves against. Hand-maintained,
// they drifted the way hand-maintained pairs do, and in the direction that
// costs the most: render-core's workspace map was an explicit 27-entry
// allowlist while its publishConfig ended in a `"./*"` wildcard, so
// `@jbrowse/render-core/webgpuUtils` failed in-tree and resolved fine from npm.
// `src/index.ts` calls those files "internal building blocks (`webgpuUtils`,
// the shader codegen) ... intentionally not re-exported", and the published
// package served every one of them. ADR-030 makes the exports map the public
// API contract; a wildcard means there isn't one.
//
// Each subpath maps to a bare string, not a `{types, import}` condition
// object. Neither condition earns its keep. `types` is redundant on every
// resolver that reads `exports` at all: tsc substitutes `.js` for `.d.ts` and
// finds the declaration sitting beside the emitted module, which under
// `bundler` / `node16` / `nodenext` it does from a bare string too. `import`
// does do something — it makes the subpath resolve for an ESM importer and
// fail for a `require()` one, since `@rollup/plugin-node-resolve` picks its
// condition list off the importer (`['default','module','import']` vs
// `['default','module','require']`). That refusal was never the point: this
// package publishes one ESM file per subpath and has nothing else to offer a
// caller, so all the condition bought was resolvers it declined to answer.
// GMOD/jbrowse-components#5626 is what that cost.
//
// There is no `typesVersions` either, and it went for the reason the count
// that justified it did not survive contact. It served exactly one audience —
// a consumer on `moduleResolution: "node"`, which reads no `exports` map and so
// resolves subpath types through `typesVersions` or not at all. The reference
// external-plugin set had 8 of 22 on that setting, but six of them cap
// `@jbrowse/core` at `^1.x` or `^2.x` and so cannot install this major at all,
// and mafviewer, the seventh, is vendored at `plugins/maf`. That left
// jbrowse-plugin-hubs, which typechecks clean against the real published tree
// with `typesVersions` deleted and `"moduleResolution": "bundler"` in its
// tsconfig — the one-line change TypeScript itself names in the TS2307 it
// raises. TS 6 already errors on `node10` as deprecated and TS 7 removes it, so
// the field was buying a reprieve nobody was left to spend.
//
// Run with `--check` in CI (via `pnpm autogen --check`) to fail on drift
// instead of rewriting.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Packages whose `exports` map is hand-curated and richer than a single
// barrel. Everything else in the monorepo exports only `.`, where the two maps
// are too small to drift.
const PACKAGES = [
  'packages/display-kit',
  'packages/render-core',
  'packages/text-indexing',
  'packages/wiggle-core',
]

interface PackageJson {
  exports?: Record<string, string>
  publishConfig?: Record<string, unknown>
}

const check = process.argv.includes('--check')
const root = join(import.meta.dirname, '..')

// './src/shaders/hpmath.js.generated.ts' -> 'shaders/hpmath.js.generated'
//
// Strips the src prefix and the TS extension only. The `.js.generated` stem is
// load-bearing and must survive: tsc emits `hpmath.js.generated.js`, which is
// exactly what a `./*` wildcard could not name (it rewrote the subpath to
// `esm/shaders/hpmath.js`, a file nobody writes) and why those five entries
// used to be spelled out by hand above the wildcard.
function emittedStem(srcPath: string) {
  return srcPath.replace(/^\.\/src\//, '').replace(/\.tsx?$/, '')
}

let failed = false

for (const pkg of PACKAGES) {
  const manifestPath = join(root, pkg, 'package.json')
  const manifest = JSON.parse(
    readFileSync(manifestPath, 'utf8'),
  ) as PackageJson & Record<string, unknown>

  const exports = manifest.exports
  if (!exports) {
    throw new Error(`${pkg}/package.json has no "exports" map to derive from`)
  }

  const publishExports: Record<string, string> = {}

  for (const [subpath, srcPath] of Object.entries(exports)) {
    publishExports[subpath] = `./esm/${emittedStem(srcPath)}.js`
  }

  manifest.publishConfig = {
    ...manifest.publishConfig,
    exports: publishExports,
  }
  delete manifest.publishConfig.typesVersions

  const next = `${JSON.stringify(manifest, null, 2)}\n`
  if (check) {
    if (readFileSync(manifestPath, 'utf8') !== next) {
      console.error(
        `${pkg} publishConfig.exports is out of date — run: node --experimental-strip-types scripts/generate-publish-exports.ts`,
      )
      failed = true
    }
  } else {
    writeFileSync(manifestPath, next)
    console.log(
      `${pkg}: ${Object.keys(publishExports).length} publish export entries`,
    )
  }
}

if (failed) {
  process.exit(1)
}
if (check) {
  console.log('publishConfig exports are up to date')
}
