import path from 'node:path'

import { moduleReach } from './importGraph.node.ts'

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
// The walk follows dynamic imports as well as static ones: a lazy chunk is a
// weaker offence than startup weight, but a deliberate lazy Material import
// here would need a `@mui/*` entry in package.json anyway, and "no Material UI
// in the graph" that `lazy(() => import(…))` can falsify is not a claim. What
// the tooltip's separate chunk costs the *critical path* is
// `tooltip/eagerBoundary.test.ts`, which walks the static edges only.
const isMui = (spec: string) => spec.startsWith('@mui/')

function muiReach(entry: string) {
  return moduleReach(entry, { offends: isMui, followDynamic: true })
}

test('nothing in the package reaches Material UI', () => {
  expect(muiReach(path.join(__dirname, 'index.ts'))).toEqual([])
})

// Entry points outside this package that owe the same guarantee.
//
// The two chrome bases stay in the LGV plugin — they are that plugin's chrome,
// and `DisplayChromeBase` is typed on `@jbrowse/render-core`'s backend — but
// they are the *weight* half of the same story: a display written over them
// imports no toolkit at all, and that is the only path that keeps Material UI
// out of a bundle rather than merely off the screen. Nothing else asserts it.
//
// `FloatingLegend` used to be listed here and is not, because it moved into
// this package — so the whole-package test above now walks it, which is the
// better arrangement and the one to reach for when a component on this list
// turns out to belong here.
const packages = path.join(__dirname, '../..')
const lgv = path.join(
  packages,
  '../plugins/linear-genome-view/src/BaseLinearDisplay/components',
)
const core = path.join(packages, 'core/src')
const weightPath = {
  DisplayChromeBase: path.join(lgv, 'DisplayChromeBase.tsx'),
  DisplayStatusChromeBase: path.join(lgv, 'DisplayStatusChromeBase.tsx'),
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
