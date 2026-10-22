import { rowAssembliesOf } from './layoutMultiWay.ts'

import type { MultiWayGroup } from './layoutMultiWay.ts'
import type { DeclaredLane } from '@jbrowse/synteny-core'

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

/** Whether a lane draws: chosen by the selection in force and not hidden. */
export function drawnLaneTest(
  selection: readonly string[] | undefined,
  hidden: readonly string[],
  keyOf: KeyOf,
) {
  const chosen = selection && new Set(selection.map(keyOf))
  const hiddenKeys = new Set(hidden.map(keyOf))
  return (name: string) => {
    const key = keyOf(name)
    return (chosen === undefined || chosen.has(key)) && !hiddenKeys.has(key)
  }
}

/**
 * The mate lanes the stack draws, in order: `preferred` first, then by their
 * heaviest contig's group weight, then each lane `placeless` names that no
 * group places
 */
export function laneRowsOf({
  groups,
  placeless,
  anchor,
  preferred,
  selection,
  hidden,
  keyOf,
}: {
  groups: MultiWayGroup[]
  placeless: readonly string[]
  anchor: string
  preferred: readonly string[]
  selection: readonly string[] | undefined
  hidden: readonly string[]
  keyOf: KeyOf
}) {
  const anchorKey = keyOf(anchor)
  const drawn = drawnLaneTest(selection, hidden, keyOf)
  return rowAssembliesOf(groups, preferred, keyOf, placeless).filter(
    name => keyOf(name) !== anchorKey && drawn(name),
  )
}

export interface LaneUniverseInputs {
  anchor: string
  mateNames: readonly string[]
  declared: readonly DeclaredLane[]
  trackAssemblies: readonly string[]
  keyOf: KeyOf
  labelOf: (name: string) => string
  selection: readonly string[] | undefined
  hidden: readonly string[]
  featuresLoaded: boolean
  landedLanes: readonly string[] | undefined
}

/** Every lane on offer, the anchor excluded: declared, then the track's, then mates. */
export function laneUniverseOf({
  anchor,
  mateNames,
  declared,
  trackAssemblies,
  keyOf,
  labelOf,
  selection,
  hidden,
  featuresLoaded,
  landedLanes,
}: LaneUniverseInputs): LaneChoice[] {
  const anchorKey = keyOf(anchor)
  const placed = new Set(mateNames.map(keyOf))
  const drawn = drawnLaneTest(selection, hidden, keyOf)
  const asked = landedLanes && new Set(landedLanes.map(keyOf))
  const known = (key: string) =>
    featuresLoaded && (asked === undefined || asked.has(key))
  const out = new Map<string, LaneChoice>()
  const offer = (lane: DeclaredLane) => {
    const key = keyOf(lane.name)
    if (key !== anchorKey && !out.has(key)) {
      const shown = labelOf(lane.name)
      const label = shown === lane.name ? lane.label : shown
      out.set(key, {
        ...lane,
        ...(label === lane.name ? {} : { label }),
        placed: placed.has(key) || (known(key) ? false : undefined),
        drawn: drawn(lane.name),
      })
    }
  }
  for (const lane of declared) {
    offer(lane)
  }
  for (const name of trackAssemblies) {
    offer({ name })
  }
  for (const name of mateNames) {
    offer({ name })
  }
  return [...out.values()]
}

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
