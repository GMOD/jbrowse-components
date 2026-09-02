import { lgvLaunchKeys } from './launchKeys.ts'

// The remaining v4 partition, still used by the synteny view to build its LGV
// rows. `lgvLaunchKeys` is the one declaration of what a launch key is, so the
// two cannot disagree while both exist.
const knownInitKeys = new Set(Object.keys(lgvLaunchKeys.keys))

// Never settable from a spec, whatever the model declares: `type` picks the
// view, `id` is passed top-level so MST's optional identifier honors it, and
// `launch` is the blob the partition fills rather than something anyone writes.
const RESERVED = new Set(['id', 'type', 'launch'])

const LEGACY_VIEWPORT_PROPS: ReadonlySet<string> = new Set(
  lgvLaunchKeys.passThrough,
)

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
      : (viewPropKeys.has(key) || LEGACY_VIEWPORT_PROPS.has(key)) &&
          !RESERVED.has(key)
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
