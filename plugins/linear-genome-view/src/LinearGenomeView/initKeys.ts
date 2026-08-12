import type { InitState } from './types.ts'

// The init keys are derived from their interface so they can't drift: the
// Record requires exactly one entry per key, so adding a field without listing
// it here is a compile error rather than a key that silently warns as "unknown".
//
// There is no matching list for the plain view props, and there must not be:
// they are whatever the state model declares, read off it by the caller and
// passed in as `viewPropKeys`. A hand-written eight is what left `hideHeader`,
// `showGridlines`, `showCytobands` and five others declared, menu-settable and
// silently unreachable from any spec — the same failure LinearSyntenyView's
// `drawLocationMarkers` had.
//
// #launchKeys LinearGenomeView — the URL parameters page renders this list
// rather than restating it; each of these keys has its own `&param=` section
// there, which is why no description is attached here.
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
const knownInitKeys = new Set(Object.keys(knownInitKeyMap))

// Never settable from a spec, whatever the model declares: `type` picks the
// view and `id` is passed top-level so MST's optional identifier honors it.
const RESERVED = new Set(['id', 'type', 'init'])

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
export function partitionLaunchKeys(
  spec: object,
  // The view's declared property names. Callers with a live node read it off
  // `getPropertyMembers(self).properties`; callers building a snapshot read it
  // off the registered view type's `stateModel.properties` — see
  // `linearGenomeViewPropKeys`.
  viewPropKeys: ReadonlySet<string>,
) {
  const init: Record<string, unknown> = {}
  const viewProps: Record<string, unknown> = {}
  const unknown: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(spec)) {
    const bucket = knownInitKeys.has(key)
      ? init
      : viewPropKeys.has(key) && !RESERVED.has(key)
        ? viewProps
        : unknown
    bucket[key] = value
  }
  return { init, viewProps, unknown }
}

// The registered LinearGenomeView's declared property names, for a caller that
// has a PluginManager but no view yet (a launcher, or a synteny row being built).
// A caller holding a live node reads the same thing off
// `getPropertyMembers(self).properties` instead.
//
// `getViewType` THROWS on an unregistered name, and that is left alone: this is
// only ever called from code that is about to add a LinearGenomeView, so an
// absent view type is a broken plugin manager rather than a case to degrade
// through — and degrading would mean silently dropping every property the
// caller asked for, which is the failure this whole mechanism exists to end.
//
// Cached: the set is fixed for the life of the manager, and a launch that opens
// a stack of rows would otherwise rebuild it per row.
const propKeyCache = new WeakMap<object, ReadonlySet<string>>()

export function linearGenomeViewPropKeys(pluginManager: {
  getViewType: (name: string) => { stateModel: { properties: object } }
}): ReadonlySet<string> {
  const cached = propKeyCache.get(pluginManager)
  if (cached) {
    return cached
  }
  const { stateModel } = pluginManager.getViewType('LinearGenomeView')
  const keys: ReadonlySet<string> = new Set(Object.keys(stateModel.properties))
  propKeyCache.set(pluginManager, keys)
  return keys
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
