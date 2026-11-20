import { laneGenome, laneOf } from './copyLane.ts'
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
  /** `rows.kept` as a choice: empty while it names no lane */
  laneChoice: readonly string[]
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

/** a lane's own key, and its genome's where it is a copy lane */
function answersTo(name: string, keyOf: KeyOf) {
  return [keyOf(name), keyOf(laneGenome(name))]
}

/**
 * Whether a lane draws: chosen by the selection in force and not hidden, a
 * copy lane by its own name or its genome's
 */
function drawnLaneTest(
  selection: readonly string[] | undefined,
  hidden: readonly string[],
  keyOf: KeyOf,
) {
  const chosen = selection && new Set(selection.map(keyOf))
  const hiddenKeys = new Set(hidden.map(keyOf))
  return (name: string) => {
    const keys = answersTo(name, keyOf)
    return (
      (chosen === undefined || keys.some(key => chosen.has(key))) &&
      !keys.some(key => hiddenKeys.has(key))
    )
  }
}

/**
 * Whether the held fetch answers for a lane: it has landed, and asked for
 * every lane or for this one
 */
export function answeredLaneTest(
  featuresLoaded: boolean,
  landedLanes: readonly string[] | undefined,
  keyOf: KeyOf,
) {
  const asked = landedLanes && new Set(landedLanes.map(keyOf))
  return (name: string) =>
    featuresLoaded && (asked === undefined || asked.has(keyOf(name)))
}

/**
 * The `rows.kept` lanes the held fetch answered for and placed nothing in,
 * each drawn as a row with no alignment in the window
 */
export function unalignedChosenLanesOf(
  choice: readonly string[],
  groups: readonly MultiWayGroup[],
  answered: (name: string) => boolean,
  keyOf: KeyOf,
) {
  const placed = new Set(
    groups.flatMap(group =>
      [...group.mates.keys()].flatMap(name => answersTo(name, keyOf)),
    ),
  )
  return choice.filter(name => answered(name) && !placed.has(keyOf(name)))
}

/**
 * A lane's label: its `rows.labels` entry, else the name the session holds
 * its genome under, else the label its source declares, else its name. A copy
 * lane without an entry of its own takes its genome's label and its contig,
 * as `shownRefName` spells it.
 */
export function laneLabelOf(
  name: string,
  {
    written,
    heldName,
    declared,
    keyOf,
    shownRefName = (_assemblyName, refName) => refName,
  }: {
    written: ReadonlyMap<string, string>
    heldName: (name: string) => string | undefined
    declared: ReadonlyMap<string, string>
    keyOf: KeyOf
    shownRefName?: (assemblyName: string, refName: string) => string
  },
): string {
  const { assemblyName, refName } = laneOf(name)
  const key = keyOf(name)
  const own = written.get(key)
  return own !== undefined
    ? own
    : refName === undefined
      ? (heldName(name) ?? declared.get(key) ?? name)
      : `${laneLabelOf(assemblyName, { written, heldName, declared, keyOf })} ${shownRefName(assemblyName, refName)}`
}

/**
 * A lane's color, the anchor's included: its `rows.colors` entry, else the
 * color its source declares, else none; a copy lane without either takes its
 * genome's
 */
export function laneColorOf(
  name: string,
  {
    pinned,
    declared,
    keyOf,
  }: {
    pinned: ReadonlyMap<string, string>
    declared: ReadonlyMap<string, string>
    keyOf: KeyOf
  },
): string | undefined {
  const key = keyOf(name)
  const genome = laneGenome(name)
  return (
    pinned.get(key) ??
    declared.get(key) ??
    (genome === name
      ? undefined
      : laneColorOf(genome, { pinned, declared, keyOf }))
  )
}

/**
 * The mate lanes the stack draws, in order: `preferred` first, then by their
 * heaviest contig's group weight, then each lane `placeless` names that no
 * group places. A copy lane on the anchor's own genome draws a paralogy hit,
 * and is dropped as a lane on the anchor's assembly is
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
    name => keyOf(laneGenome(name)) !== anchorKey && drawn(name),
  )
}

/**
 * How many of the mate lanes `rows` stack above the anchor: the leading run
 * that `sort` names before the anchor's assembly, where it names it, else
 * none. A lane placing nothing stacks at the foot whatever `sort` says, so
 * it never counts
 */
export function anchorRowOf(
  sort: readonly string[],
  rows: readonly string[],
  anchor: string,
  keyOf: KeyOf,
) {
  const keys = sort.map(keyOf)
  const before = new Set(
    keys.slice(0, Math.max(keys.indexOf(keyOf(anchor)), 0)),
  )
  const first = rows.findIndex(
    row => !answersTo(row, keyOf).some(key => before.has(key)),
  )
  return first === -1 ? rows.length : first
}

/** the mate lanes with the anchor at its row */
export function laneOrderOf(
  rows: readonly string[],
  anchor: string,
  anchorRow: number,
) {
  return [...rows.slice(0, anchorRow), anchor, ...rows.slice(anchorRow)]
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
  const answered = answeredLaneTest(featuresLoaded, landedLanes, keyOf)
  const out = new Map<string, LaneChoice>()
  const offer = (lane: DeclaredLane) => {
    const key = keyOf(lane.name)
    if (key !== anchorKey && !out.has(key)) {
      const shown = labelOf(lane.name)
      const label = shown === lane.name ? lane.label : shown
      out.set(key, {
        ...lane,
        ...(label === lane.name ? {} : { label }),
        placed: placed.has(key) || (answered(lane.name) ? false : undefined),
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
