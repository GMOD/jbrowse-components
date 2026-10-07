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
  /** `rows.kept` as a choice: undefined while it names no lane */
  laneChoice: readonly string[] | undefined
  configuredLanes: readonly string[]
  chooseLanes: (names: string[]) => void
  setSelectedLanes: (names: readonly string[] | undefined) => void
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

/** The lanes a choice leaves in force: `rows.kept`, else the track's lanes, else every lane (undefined). */
export function lanesInForce(
  kept: readonly string[],
  configured: readonly string[],
): readonly string[] | undefined {
  return kept.length ? kept : configured.length ? configured : undefined
}

/** The hidden lanes with `name` among them; both lists compare through `keyOf`. */
export function withLaneHidden(
  hidden: readonly string[],
  name: string,
  keyOf: KeyOf,
): readonly string[] {
  return has(hidden, keyOf(name), keyOf) ? hidden : [...hidden, name]
}

/** A show unhides the lane and, where a choice in force leaves it out, joins it to `kept`. */
export function withLaneShown(
  {
    kept,
    hidden,
    configured,
  }: {
    kept: readonly string[]
    hidden: readonly string[]
    configured: readonly string[]
  },
  name: string,
  keyOf: KeyOf,
): { kept: readonly string[]; hidden: readonly string[] } {
  const key = keyOf(name)
  const selection = lanesInForce(kept, configured)
  return {
    kept:
      selection && !has(selection, key, keyOf) ? [...selection, name] : kept,
    hidden: hidden.filter(n => keyOf(n) !== key),
  }
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
