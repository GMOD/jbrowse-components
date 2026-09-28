/** `except` lanes stay fetched; both lists compare through `keyOf`. */
export interface LaneFilter {
  only?: string[]
  except?: string[]
}

/** `placed` is undefined where the fetch did not ask for the lane. */
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

/** undefined means every lane */
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

/** undefined where the pick is the default the lanes come back to anyway */
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
