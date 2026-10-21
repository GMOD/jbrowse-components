// Which display a track opens as in a view, over plain data: the app feeds it
// from the PluginManager (`pickTrackDisplay` in ./tracks.ts), and the website's
// figure recipes feed it from a table generated off the same registry, so the
// two cannot disagree. Imports nothing, so a node script can load it.

export interface DisplayConfSnapshot {
  type: string
  displayId?: string
}

/** A display a track type registers, and what it needs of the adapter. */
export interface OfferedDisplay {
  name: string
  adapterCapabilities: readonly string[]
}

/** A display a view draws, and the view type that registered it. */
export interface ViewDisplay {
  name: string
  viewType: string
}

/**
 * Whether an adapter with `capabilities` serves what a display draws from:
 * every `adapterCapabilities` entry the display asks for.
 */
export function feedsDisplay(capabilities: readonly string[]) {
  const has = new Set(capabilities)
  return (display: { adapterCapabilities: readonly string[] }) =>
    display.adapterCapabilities.every(c => has.has(c))
}

/**
 * The fed display types, best first: those the config declares lead, in
 * declared order, and the rest keep the track type's order.
 */
function rankDisplayCandidates(
  fed: readonly string[],
  declared: readonly string[],
) {
  const rank = (name: string) => {
    const i = declared.indexOf(name)
    return i === -1 ? declared.length : i
  }
  return fed.toSorted((a, b) => rank(a) - rank(b))
}

/**
 * Which display a track opens with in a given view, and the declared entry
 * that configures it: `{ type, conf }`, or undefined when the view draws none
 * of the candidates or the requested type is not among them.
 *
 * The **type** is the requested one, checked rather than taken on faith (an
 * unchecked one resolved its dangling `<trackId>-<type>` id back to the
 * track's default display, and the caller was told it got what it asked for),
 * else the first candidate among the view's own display types, else the first
 * it draws at all. The **config** is then the declared entry of that type,
 * never another one the view supports: `display.type ===
 * display.configuration.type` is the invariant `DisplayConfigurationReference`
 * assumes when it falls back to resolving by type.
 */
export function pickDisplayForView({
  candidates,
  declaredDisplays,
  requestedType,
  viewDisplayTypes,
  preferredDisplayTypes = new Set<string>(),
}: {
  /** {@link rankDisplayCandidates}, canonical names in preference order */
  candidates: string[]
  /** the config's display entries, their types canonical */
  declaredDisplays: DisplayConfSnapshot[]
  requestedType: string | undefined
  viewDisplayTypes: string[]
  /**
   * The display types the view registered as its own, ahead of those it
   * inherits through `extendedName`: a variant track on the circular view
   * draws its chords, not the linear display the view also accepts as a
   * ring, even where its config declares only the linear one.
   */
  preferredDisplayTypes?: Set<string>
}) {
  const supported = new Set(viewDisplayTypes)
  const drawable = candidates.filter(name => supported.has(name))
  const type =
    requestedType === undefined
      ? (drawable.find(name => preferredDisplayTypes.has(name)) ?? drawable[0])
      : drawable.find(name => name === requestedType)
  return type === undefined
    ? undefined
    : { type, conf: declaredDisplays.find(d => d.type === type) }
}

/**
 * {@link pickDisplayForView} from the registry's own records: the track
 * type's displays, the adapter's capabilities and the view's displays. Display
 * type names, declared and requested, arrive canonical.
 */
export function chooseDisplay({
  trackDisplays,
  adapterCapabilities,
  declaredDisplays,
  viewType,
  viewDisplays,
  requestedType,
}: {
  trackDisplays: readonly OfferedDisplay[]
  adapterCapabilities: readonly string[]
  declaredDisplays: DisplayConfSnapshot[]
  viewType: string
  viewDisplays: readonly ViewDisplay[]
  requestedType: string | undefined
}) {
  const candidates = rankDisplayCandidates(
    trackDisplays.filter(feedsDisplay(adapterCapabilities)).map(d => d.name),
    declaredDisplays.map(d => d.type),
  )
  const viewDisplayTypes = viewDisplays.map(d => d.name)
  const picked = pickDisplayForView({
    candidates,
    declaredDisplays,
    requestedType,
    viewDisplayTypes,
    preferredDisplayTypes: new Set(
      viewDisplays.filter(d => d.viewType === viewType).map(d => d.name),
    ),
  })
  return { picked, candidates, viewDisplayTypes }
}
