import fs from 'fs'
import path from 'path'

import { servedPackages } from './generateReExportDocs.ts'
import { markdownTable, rewriteMarkerBlock } from './util.ts'

import type { SourceCorpus } from './util.ts'

// Render the standalone-helper-package table into the imports guide from the
// workspace manifests, because the hand-written version was not merely stale
// but actively misleading: it listed five packages under "no React/MobX/
// `@jbrowse/core` dependency ... they get bundled", and four of the five depend
// on `@jbrowse/core`. Following that advice bundles a second copy of core into
// a plugin — the exact "two diverging copies" hazard the same page warns about
// three sections further down.
//
// Two facts, each read where it actually lives:
//
//   which packages    a `packages/*` that is published (not private) and
//                     exports something tagged `#api`, i.e. has a generated API
//                     page for a plugin author to read. An internal package
//                     nothing documents is not something to recommend.
//   served or not     the re-export manifest. A served package is
//                     externalized by a plugin build; any other is bundled
//                     into the plugin, with its own imports of served
//                     packages and the framework left external.
//   what it imports   its own package.json dependencies + peerDependencies.
//
// The description is the manifest's own `description`, so a package says what
// it provides in the one place npm also reads it from.
//
// The guide opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- HELPER_PACKAGES START -->
//   <!-- HELPER_PACKAGES END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

const PACKAGES_DIR = 'packages'

// The identity-sensitive singletons. A plugin that bundles its own copy of any
// of these ends up with two of them, and the model types, registries and
// configuration system stop recognizing each other across the seam.
const SHARED = [
  '@jbrowse/core',
  '@jbrowse/mobx-state-tree',
  'mobx',
  'mobx-react',
  'react',
  'react-dom',
]

interface Pkg {
  name: string
  description: string
  shared: string[]
  served: boolean
  apiPage: string
}

function readManifest(dir: string) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
    ) as {
      name?: string
      private?: boolean
      description?: string
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
  } catch {
    return undefined
  }
}

// True when any source in the package carries an `#api` tag, i.e. the API-docs
// generator builds it a page. Read from the source text rather than from the
// generated `website/docs/api/` directory on purpose: that directory is itself
// generated, and reading one generated artifact to build another makes the two
// order-dependent within a single `pnpm autogen` run.
function hasApiExports(corpus: SourceCorpus, dir: string) {
  const prefix = `${dir}/`
  return corpus.files.some(
    f => f.startsWith(prefix) && /#api(?![A-Za-z0-9_])/.test(corpus.read(f)),
  )
}

export function collectHelperPackages(corpus: SourceCorpus): Pkg[] {
  const served = servedPackages()
  const out: Pkg[] = []
  for (const entry of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    const dir = path.join(PACKAGES_DIR, entry.name)
    const pkg = entry.isDirectory() ? readManifest(dir) : undefined
    // `@jbrowse/core` documents itself all over the guides and is the thing
    // these are alternatives to, so it is not one of them.
    if (
      !pkg?.name ||
      pkg.private ||
      pkg.name === '@jbrowse/core' ||
      !fs.existsSync(path.join(dir, 'src')) ||
      !hasApiExports(corpus, path.join(dir, 'src'))
    ) {
      continue
    }
    if (!pkg.description) {
      throw new Error(
        `${dir}/package.json has no "description", so it would render as an empty row in the imports guide`,
      )
    }
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies }
    out.push({
      name: pkg.name,
      description: pkg.description,
      shared: SHARED.filter(d => d in deps),
      served: served.has(pkg.name),
      apiPage: entry.name,
    })
  }
  return out.sort(
    (a, b) =>
      Number(b.served) - Number(a.served) ||
      a.shared.length - b.shared.length ||
      a.name.localeCompare(b.name),
  )
}

function howToUse(pkg: Pkg) {
  if (pkg.served) {
    return 'Served by the host; a plugin build externalizes it'
  }
  return pkg.shared.length
    ? `Bundled into your plugin; its imports of ${pkg.shared.map(d => `\`${d}\``).join(', ')} stay external and resolve to the host's copies`
    : 'Bundled into your plugin; it imports no framework and not `@jbrowse/core`'
}

function renderTable(packages: Pkg[]) {
  return markdownTable(
    ['Package', 'What it provides', 'How to use it'],
    packages.map(
      p =>
        `| [\`${p.name}\`](/docs/api/${p.apiPage}) | ${p.description} | ${howToUse(p)} |`,
    ),
  )
}

export function writeHelperPackageDocs(corpus: SourceCorpus) {
  return rewriteMarkerBlock(
    'HELPER_PACKAGES',
    renderTable(collectHelperPackages(corpus)),
  )
}
