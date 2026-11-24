import {
  isCopyLane,
  laneGenome,
  laneOf,
  lanesPlacedIn,
  nearestPiece,
  pieceContig,
} from './copyLane.ts'
import { rowAssembliesOf, sortedLanes } from './layoutMultiWay.ts'

import type { LaneRowsField } from './copyLane.ts'
import type { MultiWayGroup } from './layoutMultiWay.ts'
import type { DeclaredLane } from '@jbrowse/synteny-core'

/**
 * `placed` is undefined where the fetch did not ask for the lane;
 * `underFloor` marks a copy lane the window places too little of to draw
 * unless chosen
 */
export interface LaneChoice {
  name: string
  label?: string
  group?: string
  placed: boolean | undefined
  drawn: boolean
  underFloor?: boolean
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

/**
 * Whether the selection in force chooses a lane, so a selection written for
 * one `rows.field` reads in the other: a genome lane is chosen by its name or
 * any of its copies', and a copy lane by its own name, or by its genome's
 * where the selection names none of that genome's copies
 */
function chosenLaneTest(
  selection: readonly string[] | undefined,
  keyOf: KeyOf,
) {
  const keys = new Set(selection?.map(keyOf))
  const genomes = new Set(selection?.map(name => keyOf(laneGenome(name))))
  const copiesNamed = new Set(
    selection?.filter(isCopyLane).map(name => keyOf(laneGenome(name))),
  )
  return (name: string) => {
    const genome = keyOf(laneGenome(name))
    return (
      selection === undefined ||
      (isCopyLane(name)
        ? keys.has(keyOf(name)) ||
          (keys.has(genome) && !copiesNamed.has(genome))
        : genomes.has(genome))
    )
  }
}

/**
 * Whether a lane draws: chosen by the selection in force, and hidden neither
 * by its own name nor, for a copy lane, by its genome's
 */
function drawnLaneTest(
  selection: readonly string[] | undefined,
  hidden: readonly string[],
  keyOf: KeyOf,
) {
  const chosen = chosenLaneTest(selection, keyOf)
  const hiddenKeys = new Set(hidden.map(keyOf))
  return (name: string) =>
    chosen(name) &&
    !hiddenKeys.has(keyOf(name)) &&
    !hiddenKeys.has(keyOf(laneGenome(name)))
}

/**
 * Whether the held fetch answers for a lane: it has landed, and asked for
 * every lane or for this one's genome
 */
export function answeredLaneTest(
  featuresLoaded: boolean,
  landedLanes: readonly string[] | undefined,
  keyOf: KeyOf,
) {
  const asked = landedLanes && new Set(landedLanes.map(keyOf))
  return (name: string) =>
    featuresLoaded &&
    (asked === undefined || asked.has(keyOf(laneGenome(name))))
}

/**
 * The `rows.kept` lanes the held fetch answered for and placed nothing in,
 * each drawn as a row with no alignment in the window. With genome lanes, a
 * copy it names stands for its genome; with copy lanes, a genome it names is
 * placed where any copy of it is.
 */
export function unalignedChosenLanesOf(
  choice: readonly string[],
  groups: readonly MultiWayGroup[],
  answered: (name: string) => boolean,
  keyOf: KeyOf,
  field: LaneRowsField,
) {
  const placed = new Set(
    [...lanesPlacedIn(groups)].flatMap(name => [
      keyOf(name),
      keyOf(laneGenome(name)),
    ]),
  )
  const lanes = new Map<string, string>()
  for (const name of field === 'refName' ? choice : choice.map(laneGenome)) {
    const key = keyOf(name)
    if (!lanes.has(key) && !placed.has(key) && answered(name)) {
      lanes.set(key, name)
    }
  }
  return [...lanes.values()]
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

/** a piece no row holds, named by another fetch, stands for its contig's rows */
function heldPieces(
  selection: readonly string[] | undefined,
  rows: readonly string[],
  keyOf: KeyOf,
) {
  const held = new Set(rows.map(keyOf))
  return selection?.flatMap(name => {
    const contig = pieceContig(name)
    return contig === undefined || held.has(keyOf(name))
      ? [name]
      : rows.filter(row => pieceContig(row) === contig)
  })
}

/**
 * The mate lanes the stack draws, in order: `preferred` first, then by their
 * heaviest contig's group weight, then each lane `placeless` names that no
 * group places. A lane on the anchor's assembly draws a paralogy hit, so
 * never draws; an entry of `preferred` naming the anchor places the anchor,
 * not its genome's copy lanes
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
  const rows = rowAssembliesOf(
    groups,
    preferred.filter(name => keyOf(name) !== anchorKey),
    keyOf,
    placeless,
  )
  const held = new Set(rows.map(keyOf))
  const drawn = drawnLaneTest(
    heldPieces(selection, rows, keyOf),
    hidden.flatMap(name =>
      held.has(keyOf(name)) ? [name] : [nearestPiece(name, rows) ?? name],
    ),
    keyOf,
  )
  return rows.filter(name => keyOf(name) !== anchorKey && drawn(name))
}

/**
 * How many of the mate lanes `rows` stack above the anchor. With genome
 * lanes, none. With copy lanes, the leading run that the entries of `sort`
 * before the anchor's assembly place (`sortedLanes`), where it names it. A
 * lane placing nothing stacks at the foot whatever `sort` says, so it never
 * counts
 */
export function anchorRowOf({
  field,
  sort,
  rows,
  anchor,
  keyOf,
}: {
  field: LaneRowsField
  sort: readonly string[]
  rows: readonly string[]
  anchor: string
  keyOf: KeyOf
}) {
  const anchorKey = keyOf(anchor)
  const at =
    field === 'refName' ? sort.findIndex(name => keyOf(name) === anchorKey) : -1
  return at > 0
    ? leadingRun(rows, sortedLanes(rows, sort.slice(0, at), keyOf, sort))
    : 0
}

function leadingRun(rows: readonly string[], placed: readonly string[]) {
  const before = new Set(placed)
  const first = rows.findIndex(row => !before.has(row))
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
  /** copy lanes the window places too little of to draw unless chosen */
  underFloor?: readonly string[]
}

/**
 * Every lane on offer, the anchor excluded: declared, then the track's, then
 * mates, then the copy lanes under the floor, offered unticked. A genome is
 * placed where any of its copy lanes is.
 */
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
  underFloor = [],
}: LaneUniverseInputs): LaneChoice[] {
  const anchorKey = keyOf(anchor)
  const placed = new Set(
    mateNames.flatMap(name => [keyOf(name), keyOf(laneGenome(name))]),
  )
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
  for (const name of underFloor) {
    const key = keyOf(name)
    if (!out.has(key)) {
      const label = labelOf(name)
      out.set(key, {
        name,
        ...(label === name ? {} : { label }),
        placed: true,
        drawn: false,
        underFloor: true,
      })
    }
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
