import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The bring-your-own seam is a claim about a *module graph*, and every other
// check in this repo watches the DOM instead.
//
// Both existing ones — `DisplayUIProvider.test.tsx` here and the MUI census in
// `products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs` — count
// rendered `Mui*` elements. They were green, correctly, on a
// `DisplayUIProvider` that reached 45 `@mui/*` modules: the whole Material
// overlay set, `MuiTrackControl`, and (through one named import of the
// `@jbrowse/core/ui` barrel in `DisplayBackgroundProgress`) `FileSelector`,
// `FatalErrorDialog`, the cascading-menu stack and `PluginManager`. The site's
// "Removing Material UI" page carried 34 first-party eager modules importing
// `@mui/material` where the page that deliberately keeps Material chrome on
// screen carried 16, and downloaded 53 KB gzip more for it. Nothing rendered.
//
// So this walks the graph instead. Two rules, and the first is the one that
// broke: an override channel must not live in the module binding the default it
// overrides, and a file on this path names a deep subpath rather than a barrel.
//
// The trail is the whole diagnostic. "DisplayUIProvider pulls MUI" is
// unactionable; "via ./DisplayChrome.tsx -> ./DisplayBackgroundProgress.tsx ->
// @jbrowse/core/ui/index.ts" names the edge to cut.
const packages = path.join(__dirname, '../../../../../packages')
const workspace: Record<string, string> = {
  '@jbrowse/core': path.join(packages, 'core/src'),
  '@jbrowse/render-core': path.join(packages, 'render-core/src'),
  '@jbrowse/wiggle-core': path.join(packages, 'wiggle-core/src'),
  '@jbrowse/synteny-core': path.join(packages, 'synteny-core/src'),
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
  return undefined
}

function resolveFile(base: string) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`]
  // an extensionless relative import is a directory in this repo's style
  if (!path.extname(base)) {
    candidates.push(path.join(base, 'index.ts'), path.join(base, 'index.tsx'))
  }
  return candidates.find(c => existsSync(c) && path.extname(c))
}

// Value imports only — `import type` is erased, and the overlay contract is
// built out of type-only imports precisely so it costs nothing at runtime.
// `export … from` counts as much as `import … from`: a barrel is made of them.
function valueImports(file: string) {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /^(?:import|export)\s+(type\s+)?([^;]*?)from\s+'([^']+)'/gm,
    ),
  ]
    .filter(m => !m[1])
    .map(m => m[3]!)
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

// Everything an embedder mounts or writes against, plus the two plain sets it
// resolves to. A display's own component is NOT here and cannot be: a stock
// display renders `DisplayChrome` and `TrackControl` directly, so Material UI
// is in its chunk whatever a provider says. That is reach-vs-weight, and the
// line this file draws is exactly where the docs claim it is.
const seam = {
  DisplayUIProvider: 'DisplayUIProvider.tsx',
  'the overlay context': 'chromeOverlayContext.ts',
  'the track-control context': 'trackControl/trackControlContext.ts',
  plainChromeOverlays: 'plainChromeOverlays.tsx',
  plainTrackControl: 'trackControl/plainTrackControl.tsx',
  DisplayChromeBase: 'DisplayChromeBase.tsx',
  DisplayStatusChromeBase: 'DisplayStatusChromeBase.tsx',
  // Rendered by canvas, alignments, variants and multi-wiggle *directly*, so it
  // sits behind neither seam and a provider cannot redirect it. It drew seven
  // Material elements until 2026-08, and its own test counts what it renders;
  // this counts what it imports, which is the half a census misses.
  FloatingLegend: 'FloatingLegend.tsx',
}

test.each(Object.entries(seam))('%s reaches no Material UI', (_name, file) => {
  expect(muiReach(path.join(__dirname, file))).toEqual([])
})
