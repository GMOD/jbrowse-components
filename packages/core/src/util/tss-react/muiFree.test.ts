import { readFileSync } from 'node:fs'
import path from 'node:path'

// `makeStyles` is imported by 268 modules, a great many of them evaluated when
// a plugin installs. For most of JBrowse's life the theme it handed them was
// Material UI's, fetched through a six-line `useTheme` shim — and that one
// import put `createTheme`, ~51 KB, into the first paint of every host,
// including an embedded one rendering a display that draws nothing Material at
// all. It is now JBrowse's own plain-data style theme (`ui/styleTheme.ts`).
//
// Nothing about a future diff would say so. A `theme.zIndex` added back to
// `JBrowseStyleTheme` by copying MUI's, an `alpha()` imported into
// PaletteContext for convenience, and the shim is back with no line to blame.
//
// React and emotion are fine here and are the point of the module — this is
// narrower than `ui/menuItems.purity.test.ts`, which forbids all three.
const isMui = (spec: string) => spec.startsWith('@mui/')

// `export … from` counts as much as `import … from`: a barrel is made of them.
// Value imports only — `import type` is erased.
function valueImports(file: string) {
  const source = readFileSync(file, 'utf8')
  return [
    ...source.matchAll(
      /^(?:import|export)\s+(type\s+)?([^;]*?)from\s+'([^']+)'/gm,
    ),
  ]
    .filter(m => !m[1])
    .map(m => m[3]!)
}

function reach(entry: string) {
  const seen = new Set<string>()
  const bare = new Map<string, string[]>()
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    for (const spec of valueImports(file)) {
      if (spec.startsWith('.')) {
        walk(path.join(path.dirname(file), spec), [...trail, spec])
      } else if (!bare.has(spec)) {
        bare.set(spec, [...trail, spec])
      }
    }
  }
  walk(entry, [path.basename(entry)])
  return bare
}

test('makeStyles reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, 'index.ts'))
  const offenders = [...bare].filter(([spec]) => isMui(spec))
  // the trail is the whole diagnostic — "tss-react pulls MUI" is unactionable,
  // "via ../../ui/PaletteContext.tsx -> ./styleTheme.ts" is a fix
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

test('the style theme itself reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, '../../ui/styleTheme.ts'))
  expect([...bare.keys()].filter(spec => isMui(spec))).toEqual([])
})

// The hover tooltip every display renders, and the second thing this file
// guards for the same reason the first is here.
//
// It imported `Portal` and `useTheme` from `@mui/material` — the theme for one
// value, the shadow-DOM portal container — so a host that mounted
// `DisplayUIProvider` specifically to keep Material UI off its screen got a
// Material component back the moment a pointer crossed a feature. Nothing
// Material was *drawn*, which is why neither half of
// jbrowse-build-your-own's census could see it: `Portal` renders no element of
// its own to carry a `Mui*` class, and the chip sets `fontFamily: inherit`,
// which is exactly what defeats that file's Roboto fingerprint. A census is
// blind here by construction, so the guard has to be static.
//
// The container now rides on `JBrowseStyleTheme.portalContainer`, read from the
// same config slot as before, and the portal is `react-dom`'s `createPortal`.
test('the hover tooltip reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, '../../ui/BaseTooltip.tsx'))
  const offenders = [...bare].filter(([spec]) => isMui(spec))
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

// The loading bar, here for the same reason as the two above it.
//
// It was a MUI `LinearProgress` reached from `LoadingOverlay`, which
// `ComparativeFetchStatus` then drew behind neither bring-your-own seam — so a
// synteny or dotplot display's first load put a `MuiLinearProgress` on a page
// whose host had mounted `DisplayUIProvider` to keep Material off it. The
// examples site's census missed it for the ordinary reason a loading state is
// missed: the census runs once the page has settled. That component reads the
// overlay override now, so a host with its own set never reaches this at all —
// but this is still what JBrowse's own comparative loading draws.
//
// `StatusProgressBar.test.tsx` asserts the rendered tree carries no `Mui*`
// class, which is the check that catches a revert to `LinearProgress`. This is
// the half that check cannot see: `alpha()` imported for the track tint, or a
// `useTheme` reached through some helper, draws no element of its own to carry
// a class. The bar's tint is `color-mix` rather than `alpha` precisely because
// that one import is the whole cost.
test('the loading bar reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, '../../ui/StatusProgressBar.tsx'))
  const offenders = [...bare].filter(([spec]) => isMui(spec))
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

// The tracer is only worth trusting if it can see a violation, and the one it
// exists to catch is transitive. `ui/theme.ts` is the module that legitimately
// builds the MUI theme, so it is the exact negative case.
test('the tracer would catch it (ui/theme.ts fails)', () => {
  const bare = reach(path.join(__dirname, '../../ui/theme.ts'))
  expect([...bare.keys()].filter(spec => isMui(spec)).length).toBeGreaterThan(0)
})
