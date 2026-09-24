/**
 * Which lanes a multiway stack draws, as the reader has narrowed it. `only`
 * is the picker's choice, the lanes in force: an adapter declaring its lanes
 * fetches exactly these. `except` is what Hide lane took out of the drawing;
 * those lanes stay in force and fetched, so a hide never refetches and a show
 * draws at once. Both spell assembly names the way the reader's source did,
 * so every comparison goes through `keyOf`.
 */
export interface LaneFilter {
  only?: string[]
  except?: string[]
}

/**
 * One lane the picker offers: declared by the adapter's header, placed in the
 * fetched window, or both. `label` is the source's own name for it where that
 * differs from the assembly name (a haplotype's PanSN prefix against the
 * assembly it is loaded as) and `group` gathers lanes that belong together
 * (a diploid sample's two haplotypes). `placed` is whether the window places
 * the lane, undefined where the fetch did not ask for it. `drawn` is whether
 * the stack draws the lane wherever a window places it
 */
export interface LaneChoice {
  name: string
  label?: string
  group?: string
  placed: boolean | undefined
  drawn: boolean
}

export interface LaneSelectionModel {
  laneUniverse: LaneChoice[]
  laneFilter: LaneFilter | undefined
  configuredLanes: readonly string[]
  chooseLanes: (names: string[]) => void
  setSelectedLanes: (names: string[] | undefined) => void
}

/**
 * Where the picker's Reset and the track menu's undo go: the track's lanes
 * where it declares some, else every lane
 */
export function laneResetLabel(
  model: Pick<LaneSelectionModel, 'configuredLanes' | 'laneUniverse'>,
) {
  const configured = model.configuredLanes.length
  return configured
    ? `Show the track's lanes (${configured})`
    : `Show every lane (${model.laneUniverse.length})`
}

type KeyOf = (name: string) => string

const has = (names: readonly string[], key: string, keyOf: KeyOf) =>
  names.some(name => keyOf(name) === key)

/** the filter for these two lists, or undefined when neither says anything */
export function laneFilterOf(
  only: readonly string[] | undefined,
  except: readonly string[],
): LaneFilter | undefined {
  if (only === undefined && except.length === 0) {
    return undefined
  }
  const filter: LaneFilter = {}
  if (only !== undefined) {
    filter.only = [...only]
  }
  if (except.length > 0) {
    filter.except = [...except]
  }
  return filter
}

/** the lanes in force: the picker's choice, else the configured lanes, else every lane */
export function lanesInForce(
  filter: LaneFilter | undefined,
  configured: readonly string[],
): readonly string[] | undefined {
  return filter?.only ?? (configured.length ? configured : undefined)
}

export function hiddenLanesOf(
  filter: LaneFilter | undefined,
): readonly string[] {
  return filter?.except ?? []
}

/** `name` out of the drawing, whatever choice is in force */
export function withLaneHidden(
  filter: LaneFilter | undefined,
  name: string,
  keyOf: KeyOf,
): LaneFilter | undefined {
  const except = hiddenLanesOf(filter)
  return has(except, keyOf(name), keyOf)
    ? filter
    : laneFilterOf(filter?.only, [...except, name])
}

/** `name` drawn again: unhidden, and added to the lanes in force where they leave it out */
export function withLaneShown(
  filter: LaneFilter | undefined,
  configured: readonly string[],
  name: string,
  keyOf: KeyOf,
): LaneFilter | undefined {
  const key = keyOf(name)
  const except = hiddenLanesOf(filter).filter(n => keyOf(n) !== key)
  const selection = lanesInForce(filter, configured)
  const only =
    selection && !has(selection, key, keyOf)
      ? [...selection, name]
      : filter?.only
  return laneFilterOf(only, except)
}

/**
 * The picker's submit: `picked` plus any lane in force that no window has
 * offered here, or no choice at all where that is what the lanes come back to
 * (the configured lanes, else everything offered).
 */
export function pickedLanes(
  {
    picked,
    offered,
    inForce,
    configured,
  }: {
    picked: readonly string[]
    offered: readonly string[]
    inForce: readonly string[] | undefined
    configured: readonly string[]
  },
  keyOf: KeyOf,
): string[] | undefined {
  const offeredKeys = new Set(offered.map(keyOf))
  const offWindow = (inForce ?? []).filter(
    name => !offeredKeys.has(keyOf(name)),
  )
  const pickedKeys = new Set(picked.map(keyOf))
  const byDefault = new Set(
    configured.length ? configured.map(keyOf) : offeredKeys,
  )
  return offWindow.length === 0 &&
    pickedKeys.size === byDefault.size &&
    [...pickedKeys].every(key => byDefault.has(key))
    ? undefined
    : [...picked, ...offWindow]
}
