import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// A peer a dependency asks for must be provided by the package that depends on
// it, or forwarded as a peer of its own. pnpm resolves it from the workspace
// root either way, so nothing in tree notices; Yarn PnP resolves a peer only
// through the parent, so `@jbrowse/core`'s `react-dom` import fails for a
// consumer of any plugin that did not forward it. A forwarded workspace peer
// keeps the dependency's range, so none advertises a React it cannot run on.

const ROOTS = ['packages', 'plugins', 'products', 'example-plugins']

interface Manifest {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  devDependencies?: Record<string, string>
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest
}

// Some packages' `exports` hide `./package.json`, so fall back to walking up
// from the resolved entry point.
function externalManifest(fromDir: string, name: string) {
  const req = createRequire(join(fromDir, 'package.json'))
  try {
    return readJson(req.resolve(`${name}/package.json`))
  } catch {
    let dir = dirname(req.resolve(name))
    while (dir !== dirname(dir)) {
      const p = join(dir, 'package.json')
      if (existsSync(p)) {
        const m = readJson(p)
        if (m.name === name) {
          return m
        }
      }
      dir = dirname(dir)
    }
    throw new Error(`no package.json found for ${name} from ${fromDir}`)
  }
}

// `__dirname`, not `import.meta.dirname`: jest compiles this to CJS.
const repoRoot = join(__dirname, '..')

function workspace() {
  const out = new Map<string, { dir: string; manifest: Manifest }>()
  for (const r of ROOTS) {
    const tierDir = join(repoRoot, r)
    if (!existsSync(tierDir)) {
      continue
    }
    for (const d of readdirSync(tierDir)) {
      const pkgPath = join(tierDir, d, 'package.json')
      if (existsSync(pkgPath)) {
        const manifest = readJson(pkgPath)
        if (manifest.name) {
          out.set(manifest.name, { dir: join(tierDir, d), manifest })
        }
      }
    }
  }
  return out
}

test('every peer a dependency asks for is provided or forwarded', () => {
  const ws = workspace()
  const report: string[] = []
  for (const [name, { dir, manifest: m }] of ws) {
    // A private app is the consumer: its devDependencies are installed.
    const provided = new Set([
      ...Object.keys(m.dependencies ?? {}),
      ...Object.keys(m.peerDependencies ?? {}),
      ...(m.private ? Object.keys(m.devDependencies ?? {}) : []),
    ])
    for (const dep of Object.keys(m.dependencies ?? {})) {
      const inWorkspace = ws.get(dep)?.manifest
      const dm = inWorkspace ?? externalManifest(dir, dep)
      for (const [peer, range] of Object.entries(dm.peerDependencies ?? {})) {
        if (dm.peerDependenciesMeta?.[peer]?.optional) {
          continue
        }
        const own = m.peerDependencies?.[peer]
        if (!provided.has(peer)) {
          report.push(
            `${name} depends on ${dep}, which peers ${peer}@${range}, and neither provides nor forwards it`,
          )
        } else if (inWorkspace && own !== undefined && own !== range) {
          report.push(
            `${name} peers ${peer}@${own}, but its dependency ${dep} peers ${peer}@${range}`,
          )
        }
      }
    }
  }
  expect(report).toEqual([])
})
