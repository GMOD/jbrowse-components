import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The module-graph walk two guards in this package share: `muiFree.test.ts`
// asks what reaches Material UI, `tooltip/eagerBoundary.test.ts` asks what
// reaches a positioning library without going through a `lazy()` first. Both
// are claims about *imports*, which no census of rendered elements or of
// bundle bytes can make, and both want the same answer shape — the trail, not
// the verdict. "plainChromeOverlays pulls MUI" is unactionable; "via ./x.tsx ->
// @jbrowse/core/ui/index.ts" names the edge to cut.

const packages = path.join(__dirname, '../..')

const workspace: Record<string, string> = {
  '@jbrowse/core': path.join(packages, 'core/src'),
  '@jbrowse/display-ui': __dirname,
  '@jbrowse/render-core': path.join(packages, 'render-core/src'),
}

function resolveWorkspace(spec: string) {
  for (const [pkg, dir] of Object.entries(workspace)) {
    if (spec === pkg) {
      return path.join(dir, 'index')
    }
    if (spec.startsWith(`${pkg}/`)) {
      return path.join(dir, spec.slice(pkg.length + 1))
    }
  }
  // A `@jbrowse/*` this map does not know is the one shape that fails OPEN: the
  // walk would find no file, decline to call it an offender, and stop — so a
  // future import of a workspace package that itself reaches the library being
  // hunted would pass in silence, which is precisely the class of bug these
  // guards exist to catch. Add the package to `workspace` above.
  if (spec.startsWith('@jbrowse/') && !spec.startsWith('@jbrowse/mobx-state')) {
    throw new Error(
      `importGraph cannot follow '${spec}' — add its source dir to the workspace map in importGraph.node.ts`,
    )
  }
  return undefined
}

function resolveFile(base: string) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`]
  if (!path.extname(base)) {
    candidates.push(path.join(base, 'index.ts'), path.join(base, 'index.tsx'))
  }
  return candidates.find(c => existsSync(c) && path.extname(c))
}

// Value imports only — `import type` is erased, and the overlay contract is
// built out of type-only imports precisely so it costs nothing at runtime.
// `export … from` counts as much as `import … from`: a barrel is made of them.
export function valueImports(file: string) {
  const source = readFileSync(file, 'utf8')
  const statics = [
    ...source.matchAll(
      /^(?:import|export)\s+(type\s+)?([^;]*?)from\s+'([^']+)'/gm,
    ),
  ]
    .filter(m => !m[1])
    .map(m => m[3]!)
  const dynamics = [...source.matchAll(/\bimport\('([^']+)'\)/g)].map(
    m => m[1]!,
  )
  return { statics, dynamics }
}

/**
 * Every trail from `entry` to a bare specifier `offends` accepts.
 *
 * `followDynamic` is the whole difference between the two guards.
 * `import('x')` is a separate chunk rather than startup weight, so a caller
 * asking "what is on the critical path" leaves it false; one asking "is this
 * library anywhere in the graph at all" sets it true, because this repo reaches
 * for `lazy(() => import(…))` constantly and a claim a one-line idiom can
 * falsify without the check noticing is not a claim.
 */
export function moduleReach(
  entry: string,
  {
    offends,
    followDynamic,
  }: { offends: (spec: string) => boolean; followDynamic: boolean },
) {
  const seen = new Set<string>()
  const offenders: string[] = []
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    const { statics, dynamics } = valueImports(file)
    for (const spec of followDynamic ? [...statics, ...dynamics] : statics) {
      const target = spec.startsWith('.')
        ? resolveFile(path.join(path.dirname(file), spec))
        : resolveFile(resolveWorkspace(spec) ?? '')
      if (target) {
        walk(target, [...trail, path.relative(__dirname, target)])
      } else if (offends(spec)) {
        offenders.push(`${spec} via ${[...trail, spec].join(' -> ')}`)
      }
    }
  }
  walk(entry, [])
  return offenders
}
