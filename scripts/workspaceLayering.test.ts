import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// The workspace has a direction — `packages/` under `plugins/` under
// `products/` — and until this file existed, nothing said so and nothing
// checked it. That is the same disease `reference/PLUGIN_ABI_STABILITY.md`
// names for the export surface: a property that is real, load-bearing, and
// invisible, so nobody can tell a deliberate edge from one that was added
// because the import resolved.
//
// It resolves for two reasons that have nothing to do with intent. pnpm links
// every workspace package into the root `node_modules`, so an undeclared import
// of any of them typechecks and runs; and a `dependencies` entry is a one-line
// edit that no reviewer reads as an architectural change. `@jbrowse/web` is
// imported by 50 test files across seven plugins, and the root `package.json`
// is where it is declared for them — a repo-level test dependency on a private
// product, not seven package-level ones.
//
// So this pins the edges that cross a tier upward, symmetrically: a new one
// fails here, and so does removing one without deleting its entry below. The
// point is not that these edges are wrong — each one has a reason, written
// beside it. The point is that adding the next one should be a decision.

const ROOTS = ['packages', 'plugins', 'example-plugins', 'products'] as const
type Root = (typeof ROOTS)[number]

// `example-plugins/*` are demo plugins and sit in the plugin tier with the real
// ones. Everything in `packages/` is a library tier below plugins — including
// `product-core` / `app-core` / `web-core` / `embedded-core`, which are the
// libraries the products are assembled from rather than products themselves,
// and which depend on no plugin.
const TIER: Record<Root, 'lib' | 'plugin' | 'product'> = {
  packages: 'lib',
  plugins: 'plugin',
  'example-plugins': 'plugin',
  products: 'product',
}

interface Manifest {
  name?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// `__dirname`, not `import.meta.dirname`: jest compiles this to CJS, where
// `import.meta` is a syntax error. Same reason render-core's publicApi.test.ts
// spells it this way, while the `scripts/*.ts` that node runs directly do not.
const root = join(__dirname, '..')
const rootOf = new Map<string, Root>()
const manifests: { name: string; root: Root; manifest: Manifest }[] = []
for (const r of ROOTS) {
  for (const dir of readdirSync(join(root, r))) {
    const path = join(root, r, dir, 'package.json')
    if (!existsSync(path)) {
      continue
    }
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest
    if (!manifest.name) {
      continue
    }
    rootOf.set(manifest.name, r)
    manifests.push({ name: manifest.name, root: r, manifest })
  }
}

// Only workspace ranges. A same-named package from npm would be a different
// thing entirely, and is not this file's business.
function workspaceDeps(manifest: Manifest, fields: (keyof Manifest)[]) {
  return fields
    .flatMap(f =>
      Object.entries((manifest[f] as Record<string, string> | undefined) ?? {}),
    )
    .filter(([, range]) => String(range).startsWith('workspace:'))
    .map(([name]) => name)
}

function edges(
  fields: (keyof Manifest)[],
  from: 'lib' | 'plugin',
  to: 'plugin' | 'product',
) {
  return manifests
    .filter(m => TIER[m.root] === from)
    .flatMap(m =>
      workspaceDeps(m.manifest, fields)
        .filter(d => {
          const r = rootOf.get(d)
          return r !== undefined && TIER[r] === to
        })
        .map(d => `${m.name} -> ${d}`),
    )
    .sort()
}

const RUNTIME = ['dependencies', 'peerDependencies'] as const

describe('workspace layering', () => {
  it('lets no plugin ship a dependency on a product', () => {
    // The strongest of the three, and the only one with no exceptions: a plugin
    // is a library a third party installs, and a product is a whole application.
    // A runtime edge here would put an app in a plugin's dependency closure.
    //
    // Test-only edges are a separate question, answered below.
    expect(edges([...RUNTIME], 'plugin', 'product')).toEqual([])
  })

  it('lets a package depend on a plugin only where recorded', () => {
    expect(edges([...RUNTIME], 'lib', 'plugin')).toEqual([
      // Type-only, and erased at runtime: sv-core's breakpoint navigation
      // describes positions across LGV rows, so its signatures name
      // `LinearGenomeViewModel`. There is no value import, and there is nothing
      // lower to move the type to — it is the LGV's own model type.
      '@jbrowse/sv-core -> @jbrowse/plugin-linear-genome-view',
      // A real value edge, and the right way round despite appearances.
      // tree-sidebar renders *into* LGV chrome: `TrackOverlayPortal` /
      // `TrackOverlayContext` escape the display sandbox above the LGV's own
      // inter-region masks, and the context's only provider is the LGV's
      // `TrackContainer`. Moving the context to a lower package would separate
      // it from the single component that fills it, which is worse than the
      // edge.
      '@jbrowse/tree-sidebar -> @jbrowse/plugin-linear-genome-view',
    ])
  })

  it('lets a package depend on a product only where recorded', () => {
    expect(edges([...RUNTIME], 'lib', 'product')).toEqual([
      // browser-test-utils is `private: true` test infrastructure, not a
      // published library — it drives real browsers, so it consumes the capture
      // product the same way a test consumes the app under test.
      '@jbrowse/browser-test-utils -> @jbrowse/capture',
    ])
  })

  it('lets no plugin take a test-only edge into a product either', () => {
    // Seven plugins used to declare `@jbrowse/web` for the `createTestSession`
    // their integration tests build a session with. Every one of those tests
    // resolves it through the root `node_modules` link the root
    // `package.json` already asks for, so the per-plugin copies changed no
    // resolution and closed 125 workspace cycles — `@jbrowse/web` depends on
    // every plugin. `disallowWorkspaceCycles` in `pnpm-workspace.yaml` fails
    // the install on the next one; this says the same thing to a reader who
    // came here to find out which direction the tiers run.
    expect(edges(['devDependencies'], 'plugin', 'product')).toEqual([])
  })
})
