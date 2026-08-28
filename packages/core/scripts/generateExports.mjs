import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')
const repoRoot = join(packageRoot, '../..')
const srcDir = join(packageRoot, 'src')

// Exports to keep even if not used internally (for backwards compatibility).
//
// This is one of the two answers when `abiPreviousRelease.test.ts` reports a
// subpath the last published `@jbrowse/core` served and this map no longer
// does. Take this one when the promise should stand; take `SUBPATH_REMOVALS` in
// `src/ReExports/knownRemovals.ts` when the removal is meant. Entries here were
// each added after something broke, which is the disease the gate treats.
const preservedExports = [
  '@jbrowse/core/util/nanoid',
  '@jbrowse/core/ReExports/list',
  '@jbrowse/core/rpc/RpcRegistry',
  '@jbrowse/core/util/fileHandleStore',
  '@jbrowse/core/util/tss-react/types',
  '@jbrowse/core/configuration/configurationSchema',
  // Referenced as string literals in ReExports runtime module registry
  '@jbrowse/core/util/layouts',
  // jest.mock target for stable adapter ids in tests
  '@jbrowse/core/data_adapters/BaseAdapter/getAdapterId',
  // util/index.ts <-> offscreenCanvasPonyfill.ts re-export each other; only
  // imported by relative path in-package, but bundlers resolving that cycle
  // through the canvas-sequencer-ts CJS interop boundary re-resolve it as a
  // package subpath, so it needs its own exports entry
  '@jbrowse/core/util/offscreenCanvasPonyfill',
  // The `Core-extendWorker` extension point exists for jbrowse-plugin-apollo,
  // whose worker-side sequence adapter asks the main thread for sequence over
  // the handle. Both the handle type and the point's `ExtensionPointRegistry`
  // declaration live in this module, and in-repo nothing imports it by subpath
  // — so without an entry here the plugin it is for can neither name
  // `WorkerHandle` nor load the augmentation that would check its callback. It
  // declared its own `{ client, worker }` shape instead, which typechecked
  // against nothing and broke at runtime when the handle flattened.
  '@jbrowse/core/rpc/WebWorkerRpcDriver',
  // Exists precisely so callers can reach `unzip` WITHOUT the util barrel,
  // which would put bgzf + pako on the startup path of every page (see
  // src/util/unzip.ts). In-repo use comes and goes — the last two importers
  // moved to util/tabix's header reader — but an external plugin decompressing
  // a bgzf file has no other entry point, so usage is not the test here.
  '@jbrowse/core/util/unzip',
  // A data module, not API: the removal record `generate-abi-removals.ts`
  // renders into PLUGIN_ABI_STABILITY.md and the upgrade guide. Nothing
  // in-repo imports it by subpath — the generator reaches it by relative path
  // from website/scripts. `products/jbrowse-web/src/sessionExports.test.ts`
  // imports it by subpath to check that a session member the record marks
  // gone stays gone, which is the same reason a session baseline needed this
  // entry rather than being able to build itself the way pluginExports.test.ts
  // does (that one names no core module at all).
  '@jbrowse/core/ReExports/knownRemovals',
]

// The directories whose import sites decide what @jbrowse/core publishes.
// `example-plugins` is here because `score-example` is the exemplar an external
// plugin author copies -- ADR-030's hand-composed stack, built against the
// published subpaths and nothing else -- so its imports ARE the third-party
// surface core is promising, not incidental in-repo use. `component_tests` is
// not: those six are build-integration smoke suites, and today they import no
// core subpath at all.
const scanDirs = 'packages plugins products example-plugins'

// Scan the codebase for all @jbrowse/core imports
function findAllImports() {
  try {
    // Find static imports: from '@jbrowse/core/...'
    const staticImports = execSync(
      `grep -roh "from '@jbrowse/core[^']*'" ${scanDirs} --include="*.ts" --include="*.tsx" --exclude="*.d.ts" 2>/dev/null | grep -v node_modules | sed "s/from '//;s/'$//" | sort -u`,
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    // Find dynamic imports: import('@jbrowse/core/...')
    const dynamicImports = execSync(
      `grep -roh "import('@jbrowse/core[^']*')" ${scanDirs} --include="*.ts" --include="*.tsx" --exclude="*.d.ts" 2>/dev/null | grep -v node_modules | sed "s/import('//;s/')$//" | sort -u`,
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    const allImports = [...new Set([...staticImports, ...dynamicImports])]
    return allImports.filter(i => i.startsWith('@jbrowse/core'))
  } catch (e) {
    console.error('Error scanning for imports:', e.message)
    return []
  }
}

const unresolved = []

// Check if a path is a directory with index file or a file
function getSourcePath(entry) {
  const relativePath = entry.replace('@jbrowse/core/', '')
  const dirPath = join(srcDir, relativePath)

  // Check if it's a directory with index.ts or index.tsx
  if (existsSync(dirPath)) {
    if (existsSync(join(dirPath, 'index.ts'))) {
      return `/${relativePath}/index.ts`
    }
    if (existsSync(join(dirPath, 'index.tsx'))) {
      return `/${relativePath}/index.tsx`
    }
  }

  // Check for .ts, .tsx, or .js file
  if (existsSync(`${dirPath}.ts`)) {
    return `/${relativePath}.ts`
  }
  if (existsSync(`${dirPath}.tsx`)) {
    return `/${relativePath}.tsx`
  }
  if (existsSync(`${dirPath}.js`)) {
    return `/${relativePath}.js`
  }

  // Hard failure, not a warning. The scan is a grep, so any string shaped like
  // an import specifier is one -- a code COMMENT quoting `@jbrowse/core/...`
  // scans as a real import site and used to write that literal into the exports
  // map as a subpath resolving to nothing. Every path a clean tree finds
  // resolves, so an unresolvable one is always a mistake somewhere.
  unresolved.push(entry)
  return `/${relativePath}.ts`
}

function getOutputPath(entry) {
  const relativePath = entry.replace('@jbrowse/core/', '')
  const dirPath = join(srcDir, relativePath)

  // Check if it's a directory with index file
  if (existsSync(dirPath)) {
    if (
      existsSync(join(dirPath, 'index.ts')) ||
      existsSync(join(dirPath, 'index.tsx'))
    ) {
      return `/${relativePath}/index.js`
    }
  }

  // Default: assume it's a file
  return `/${relativePath}.js`
}

// Find all imports and add preserved exports
// Sort using JS string comparison (consistent across locales, unlike shell sort -u)
const imports = [...new Set([...findAllImports(), ...preservedExports])].sort()
console.log(`Found ${imports.length} unique @jbrowse/core import paths`)

// Generate dev exports (pointing to src)
// Using simple string format since import/require point to same .ts file
// Note: No "." entry - this package is designed for subpath imports only
const devExports = {}

// Generate publish exports (pointing to esm)
// Note: No "." entry - this package is designed for subpath imports only
//
// A bare string, not a `{types, import}` condition object: tsc finds the
// `.d.ts` beside the emitted `.js` on its own, and an `import` condition only
// buys the power to refuse a resolver that asks under `require` — which for a
// package that publishes one ESM file per subpath is nothing it wanted to
// refuse. See scripts/generate-publish-exports.ts, which does the same for the
// packages whose map is hand-curated.
const publishExports = {}

for (const entry of imports) {
  const exportPath = entry.replace('@jbrowse/core', '.')
  const srcPath = getSourcePath(entry)
  const outPath = getOutputPath(entry)

  devExports[exportPath] = `./src${srcPath}`

  publishExports[exportPath] = `./esm${outPath}`
}

if (unresolved.length) {
  console.error(
    `No source file under packages/core/src for:\n${unresolved
      .map(e => `  ${e}`)
      .join(
        '\n',
      )}\nEither the import site is a typo, or it is a comment quoting an import specifier, which this grep cannot tell apart from one.`,
  )
  process.exit(1)
}

// Read package.json
const packageJsonPath = join(packageRoot, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

// Update exports for dev time
packageJson.exports = devExports

// Update publishConfig exports for publish time
if (!packageJson.publishConfig) {
  packageJson.publishConfig = {}
}
packageJson.publishConfig.exports = publishExports
delete packageJson.publishConfig.typesVersions

const next = `${JSON.stringify(packageJson, null, 2)}\n`

if (process.argv.includes('--check')) {
  if (readFileSync(packageJsonPath, 'utf8') !== next) {
    console.error(
      '@jbrowse/core exports are out of date — run: node packages/core/scripts/generateExports.mjs',
    )
    process.exit(1)
  }
  console.log('@jbrowse/core exports are up to date')
} else {
  writeFileSync(packageJsonPath, next)
}

console.log(`Generated ${Object.keys(devExports).length} dev export entries`)
console.log(
  `Generated ${Object.keys(publishExports).length} publish export entries`,
)
