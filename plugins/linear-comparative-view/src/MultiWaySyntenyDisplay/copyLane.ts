import type { MatePlacement, MultiWayGroup } from './layoutMultiWay.ts'

// An old duplication keeps few of its genes: on the grape-peach gamma window
// (peach chrG7:17.9-19.1 Mb) the older grape copies hold a fifth and a sixth
// of the ortholog's pairs, and the next contig a fourteenth.
export const COPY_SHARE = 0.1

/**
 * What one lane is, `rows.field`: a genome, or with `refName` one contig of a
 * genome holding a copy of the anchor window, a polyploid's homoeolog or an
 * old duplication's ohnolog.
 */
export const LANE_ROWS_FIELDS = ['assembly', 'refName'] as const
export type LaneRowsField = (typeof LANE_ROWS_FIELDS)[number]

/** `rows.field` as written, `auto` choosing by the track's genomes */
export const LANE_ROWS_SETTINGS = ['auto', ...LANE_ROWS_FIELDS] as const
export type LaneRowsSetting = (typeof LANE_ROWS_SETTINGS)[number]

/**
 * What one lane is under `setting`. `auto` draws a lane per copy where the
 * track's genomes name at most one besides the anchor: every gutter already
 * reads against the anchor, and the copies are what the track is opened to
 * see. Across more genomes, or a track naming none, a lane per genome.
 */
export function laneFieldOf(
  setting: LaneRowsSetting,
  trackGenomes: readonly string[],
  isAnchor: (assemblyName: string) => boolean,
): LaneRowsField {
  return setting === 'auto'
    ? trackGenomes.length > 0 &&
      trackGenomes.filter(name => !isAnchor(name)).length <= 1
      ? 'refName'
      : 'assembly'
    : setting
}

/**
 * A copy lane's name, as a locstring names a contig with its assembly:
 * `{grape}chr9`. A genome lane's name is its assembly name.
 */
export function copyLaneName(assemblyName: string, refName: string) {
  return `{${assemblyName}}${refName}`
}

const COPY_LANE = /^\{([^}]+)\}(.+)$/

/** the genome a lane draws, and the contig where it is a copy lane */
export function laneOf(lane: string): {
  assemblyName: string
  refName?: string
} {
  const match = COPY_LANE.exec(lane)
  return match
    ? { assemblyName: match[1]!, refName: match[2]! }
    : { assemblyName: lane }
}

export function laneGenome(lane: string) {
  return laneOf(lane).assemblyName
}

export function isCopyLane(lane: string) {
  return laneOf(lane).refName !== undefined
}

interface LaneAssemblies {
  getCanonicalAssemblyName: (name: string) => string | undefined
  has: (name: string) => boolean
  get: (
    name: string,
  ) => { getCanonicalRefName2: (refName: string) => string } | undefined
}

type KeyOf = (lane: string) => string

/**
 * The key two spellings of one lane share: its genome's, and a copy lane's
 * contig as `refNameKey` spells it under that genome
 */
export function laneKeyWith(
  lane: string,
  genomeKey: (assemblyName: string) => string,
  refNameKey: (genome: string, refName: string) => string,
) {
  const { assemblyName, refName } = laneOf(lane)
  const genome = genomeKey(assemblyName)
  return refName === undefined
    ? genome
    : copyLaneName(genome, refNameKey(genome, refName))
}

/**
 * The canonical name, so two spellings of one lane share a key: a copy lane's
 * assembly and refName each canonical, where the session holds its genome.
 * The refName's canonical spelling reads the genome's aliases, so a
 * derivation comparing keys starts the genome loading and runs again once it
 * has.
 */
export function laneKeyIn(assemblyManager: LaneAssemblies, lane: string) {
  return laneKeyWith(
    lane,
    name => assemblyManager.getCanonicalAssemblyName(name) ?? name,
    (genome, refName) =>
      (assemblyManager.has(genome) &&
        assemblyManager.get(genome)?.getCanonicalRefName2(refName)) ||
      refName,
  )
}

export interface CopyLaneFiling {
  /** a lane `rows.kept` names, which draws under the floor */
  chosen: (lane: string) => boolean
  /**
   * a lane on the anchor's own contig, whose mates are the self-diagonal an
   * all-against-all source states for every gene
   */
  onAnchorContig: (lane: string) => boolean
  /**
   * a group the window shows: only these weigh against the floor, so a copy
   * whose genes all sit in the fetch's margin past the viewport draws no lane
   */
  inWindow: (group: MultiWayGroup) => boolean
}

/**
 * The filing `rows.kept` and the anchor's contigs, each `{anchor}refName`,
 * call for, every lane compared by its key
 */
export function copyLaneFiling(
  kept: readonly string[],
  anchorContigs: readonly string[],
  keyOf: KeyOf,
  inWindow: (group: MultiWayGroup) => boolean = () => true,
): CopyLaneFiling {
  const keys = new Map<string, string>()
  const keyed = (lane: string) => {
    let key = keys.get(lane)
    if (key === undefined) {
      key = keyOf(lane)
      keys.set(lane, key)
    }
    return key
  }
  const keptKeys = new Set(kept.map(keyOf))
  const anchorKeys = new Set(anchorContigs.map(keyOf))
  return {
    chosen: lane => keptKeys.has(keyed(lane)),
    onAnchorContig: lane => anchorKeys.has(keyed(lane)),
    inWindow,
  }
}

/**
 * `groups` with each mate filed under its contig's copy lane. A contig holding
 * under `COPY_SHARE` of its genome's heaviest contig's evidence is a stray
 * paralog hit, not a copy, and draws no lane unless `chosen` names it. A mate
 * on the anchor's own contig files nowhere; one on another contig of the
 * anchor's genome is a copy like any other. Only the groups `inWindow` shows
 * weigh against the floor.
 */
export function fileUnderCopies(
  groups: readonly MultiWayGroup[],
  {
    chosen = () => false,
    onAnchorContig = () => false,
    inWindow = () => true,
  }: Partial<CopyLaneFiling> = {},
) {
  const filed = groups.map(group => {
    const mates = new Map<string, MatePlacement[]>()
    for (const [assemblyName, placements] of group.mates) {
      for (const p of placements) {
        const lane = copyLaneName(assemblyName, p.refName)
        if (!onAnchorContig(lane)) {
          mates.set(lane, [...(mates.get(lane) ?? []), p])
        }
      }
    }
    return { group, mates }
  })
  const evidence = new Map<string, number>()
  for (const { group, mates } of filed.filter(({ group }) => inWindow(group))) {
    for (const [lane, placements] of mates) {
      evidence.set(
        lane,
        (evidence.get(lane) ?? 0) + group.weight * placements.length,
      )
    }
  }
  const heaviest = new Map<string, number>()
  for (const [lane, weight] of evidence) {
    const genome = laneGenome(lane)
    heaviest.set(genome, Math.max(heaviest.get(genome) ?? 0, weight))
  }
  const drawn = (lane: string) => {
    const weight = evidence.get(lane)
    return (
      chosen(lane) ||
      (weight !== undefined &&
        weight >= heaviest.get(laneGenome(lane))! * COPY_SHARE)
    )
  }
  return filed.map(({ group, mates }) => ({
    ...group,
    mates: new Map([...mates].filter(([lane]) => drawn(lane))),
  }))
}

/** each lane the groups place, once */
export function lanesPlacedIn(groups: readonly MultiWayGroup[]) {
  return new Set(groups.flatMap(group => [...group.mates.keys()]))
}

/**
 * The copy lanes `grouped` places that `filed` drops under the floor, which
 * the lane dialog offers unticked
 */
export function copyLanesUnderFloor(
  grouped: readonly MultiWayGroup[],
  filed: readonly MultiWayGroup[],
  filing: CopyLaneFiling,
) {
  const drawn = lanesPlacedIn(filed)
  return [
    ...lanesPlacedIn(
      fileUnderCopies(grouped, { ...filing, chosen: () => true }),
    ),
  ].filter(lane => !drawn.has(lane))
}

/**
 * The groups `rows.field` draws, the display's and the export's alike: each
 * mate under its genome's lane, or under its copy lane as `filing` files it
 */
export function groupsOfField(
  field: LaneRowsField,
  grouped: MultiWayGroup[],
  filing: () => CopyLaneFiling,
) {
  return field === 'refName' ? fileUnderCopies(grouped, filing()) : grouped
}
