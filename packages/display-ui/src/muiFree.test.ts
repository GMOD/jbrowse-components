import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// This package's whole claim is a *module graph*, and until it existed every
// check on that claim watched the DOM instead.
//
// `DisplayUIProvider.test.tsx` and the MUI census in
// `products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs` both count
// rendered `Mui*` elements. Both were green, correctly, on a provider that
// reached 45 `@mui/*` modules: the two `createContext` calls lived in the
// modules binding the Material sets, and one named import of the
// `@jbrowse/core/ui` barrel added `FileSelector`, `FatalErrorDialog`, the
// cascading-menu stack and `PluginManager`. The build-your-own site's "Removing
// Material UI" page carried 34 first-party eager modules importing
// `@mui/material` where the page that deliberately keeps Material chrome on
// screen carried 16 — and 53 KB gzip more. Nothing rendered.
//
// package.json is the first line of defence now and needs no test: nothing here
// depends on `@mui/*`, so npm would have to resolve it through `@jbrowse/core`,
// which is exactly what this catches. The rule is the barrel: `@jbrowse/core`
// publishes 179 deep subpaths and its `ui` barrel pulls the toolkit, so a file
// here names `@jbrowse/core/ui/ProgressChip`, never `@jbrowse/core/ui`.
//
// The trail is the whole diagnostic. "plainChromeOverlays pulls MUI" is
// unactionable; "via ./x.tsx -> @jbrowse/core/ui/index.ts" names the edge.
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
  // walk would find no file, decline to call it an `@mui/*` offender, and stop —
  // so a future import of a workspace package that itself reaches Material UI
  // would pass in silence, which is precisely the class of bug this file exists
  // to catch. Add the package to `workspace` above.
  if (spec.startsWith('@jbrowse/') && !spec.startsWith('@jbrowse/mobx-state')) {
    throw new Error(
      `muiFree cannot follow '${spec}' — add its source dir to the workspace map in this file`,
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
//
// `import('x')` counts too. It is a separate chunk rather than startup weight,
// so it is a weaker offence than a static import — but this repo reaches for
// `lazy(() => import(…))` constantly, and a claim of "no Material UI in the
// graph" that a one-line idiom can falsify without the check noticing is not a
// claim. A deliberate lazy Material import here would need a `@mui/*` entry in
// package.json anyway, which is the stronger guard this one backs up.
function valueImports(file: string) {
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
  return [...statics, ...dynamics]
}

function muiReach(entry: string) {
  const seen = new Set<string>()
  const offenders: string[] = []
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    for (const spec of valueImports(file)) {
      const target = spec.startsWith('.')
        ? resolveFile(path.join(path.dirname(file), spec))
        : resolveFile(resolveWorkspace(spec) ?? '')
      if (target) {
        walk(target, [...trail, path.relative(__dirname, target)])
      } else if (spec.startsWith('@mui/')) {
        offenders.push(`${spec} via ${[...trail, spec].join(' -> ')}`)
      }
    }
  }
  walk(entry, [])
  return offenders
}

test('nothing in the package reaches Material UI', () => {
  expect(muiReach(path.join(__dirname, 'index.ts'))).toEqual([])
})

// The two chrome bases stay in the LGV plugin — they are that plugin's chrome,
// and `DisplayChromeBase` is typed on `@jbrowse/render-core`'s backend — but
// they are the *weight* half of the same story: a display written over them
// imports no toolkit at all, and that is the only path that keeps Material UI
// out of a bundle rather than merely off the screen. Nothing else asserts it.
const lgv = path.join(
  __dirname,
  '../../../plugins/linear-genome-view/src/BaseLinearDisplay/components',
)
const core = path.join(packages, 'core/src')
const weightPath = {
  DisplayChromeBase: path.join(lgv, 'DisplayChromeBase.tsx'),
  DisplayStatusChromeBase: path.join(lgv, 'DisplayStatusChromeBase.tsx'),
  // Rendered by canvas, alignments, variants and multi-wiggle *directly*, so it
  // sits behind neither seam and no provider can redirect it. It drew seven
  // Material elements until 2026-08; its own test counts what it renders, and
  // this counts what it imports, which is the half a census misses.
  FloatingLegend: path.join(lgv, 'FloatingLegend.tsx'),
  // The same shape, found the same way, fixed the same way — and it had only
  // half the guard. DISPLAYCHROME.md names `BaseTooltip` and `FloatingLegend`
  // together: each is rendered by a display directly, behind neither seam, and
  // each was drawing Material UI while the census scored it zero. `BaseTooltip`
  // was pinned only by a test counting what it renders, which is the check its
  // own history proves insufficient — a tooltip appears only on a hover the
  // browser census never performs.
  BaseTooltip: path.join(core, 'ui/BaseTooltip.tsx'),
  // The determinate bar every loading indicator reaches, including the
  // comparative displays' — which sit behind neither seam, so an embedder who
  // mounted `DisplayUIProvider` used to get a `MuiLinearProgress` anyway. Its
  // own test asserts the rendered tree; this catches an `alpha()` reached two
  // modules deep, which is how it would regress.
  StatusProgressBar: path.join(core, 'ui/StatusProgressBar.tsx'),
}

test.each(Object.entries(weightPath))(
  '%s reaches no Material UI',
  (_name, file) => {
    expect(muiReach(file)).toEqual([])
  },
)
