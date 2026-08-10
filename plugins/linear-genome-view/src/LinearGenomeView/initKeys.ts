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
  showAminoAcids: true,
  showHighlightChips: true,
}
const knownInitKeys = new Set(Object.keys(knownInitKeyMap))
const knownLaunchPropKeys = new Set(Object.keys(knownLaunchPropMap))

// Partition launch keys three ways, once, for every caller that needs to know
// which is which:
//
// - `init`: resolution keys (loc, tracks, highlight, …) with no direct MST
//   representation, which afterAttach applies on attach and then discards
// - `viewProps`: plain persisted props MST restores natively, so they belong on
//   the view snapshot rather than in the blob
// - `unknown`: neither, i.e. a typo. MST silently drops unknown snapshot keys and
//   `init` is a frozen blob, so nothing else would notice
//
// The two callers differ only in what they do with each bucket: the launcher
// spreads a flat spec across the new view's snapshot and warns about the typos,
// while afterAttach — which only ever sees an already-built blob — warns about
// both a typo and a view prop that ended up inside it.
export function partitionLaunchKeys(spec: object) {
  const init: Record<string, unknown> = {}
  const viewProps: Record<string, unknown> = {}
  const unknown: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(spec)) {
    const bucket = knownInitKeys.has(key)
      ? init
      : knownLaunchPropKeys.has(key)
        ? viewProps
        : unknown
    bucket[key] = value
  }
  return { init, viewProps, unknown }
}

// Report the `unknown` bucket. Both callers say the same thing about the same
// mistake and differ only in which surface they name, so the wording lives next
// to the partition that produces the bucket rather than in two hand-written
// copies that drift.
export function warnUnknownLaunchKeys(surface: string, unknown: object) {
  const keys = Object.keys(unknown)
  if (keys.length) {
    console.warn(`${surface} ignored unknown key(s): ${keys.join(', ')}`)
  }
}
