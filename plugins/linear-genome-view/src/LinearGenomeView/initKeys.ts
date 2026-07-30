import type { InitState, LinearGenomeViewLaunchProps } from './types.ts'

// Both key sets are derived from their interfaces so they can't drift: the
// Records require exactly one entry per key, so adding a field without listing
// it here is a compile error rather than a key that silently warns as "unknown".
const knownInitKeyMap: Record<keyof InitState, true> = {
  loc: true,
  grow: true,
  assembly: true,
  displayedRegionNames: true,
  tracks: true,
  tracklist: true,
  nav: true,
  highlight: true,
}
const knownLaunchPropMap: Record<keyof LinearGenomeViewLaunchProps, true> = {
  showCenterLine: true,
  trackLabels: true,
  colorByCDS: true,
  showHighlightChips: true,
}
const knownInitKeys = new Set(Object.keys(knownInitKeyMap))
const knownLaunchPropKeys = new Set(Object.keys(knownLaunchPropMap))

// A declarative init is easy to typo (e.g. `tracksList`, `highlights`); MST
// stores it as a frozen blob, so a mistyped key would otherwise be silently
// dropped with no diagnostic. A plain view prop nested inside init is the other
// common slip and gets its own message: the key is real, it just belongs on the
// view snapshot next to init, where MST restores it natively.
export function initKeyProblems(init: object) {
  const keys = Object.keys(init)
  return {
    viewProps: keys.filter(k => knownLaunchPropKeys.has(k)),
    unknown: keys.filter(
      k => !knownInitKeys.has(k) && !knownLaunchPropKeys.has(k),
    ),
  }
}

// Split a launch spec: resolution keys (loc, tracks, highlight, …) go into the
// one-shot `init` blob that afterAttach applies then discards; plain persisted
// props (showCenterLine, colorByCDS, …) go straight onto the view snapshot,
// where MST restores them natively. MST silently drops unknown snapshot keys, so
// anything in neither set is a typo the caller reports rather than swallows.
export function splitLaunchSpec(spec: object) {
  const init: Record<string, unknown> = {}
  const viewProps: Record<string, unknown> = {}
  const unknown: string[] = []
  for (const [key, value] of Object.entries(spec)) {
    if (knownInitKeys.has(key)) {
      init[key] = value
    } else if (knownLaunchPropKeys.has(key)) {
      viewProps[key] = value
    } else {
      unknown.push(key)
    }
  }
  return { init, viewProps, unknown }
}
