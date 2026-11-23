import { doesIntersect2 } from '@jbrowse/core/util'

import { blocksOf, extentOf } from '../alignmentBlocks.ts'

import type { MatePlacement, MultiWayGroup } from './layoutMultiWay.ts'

// An old duplication keeps few of its genes: on the grape-peach gamma window
// (peach chrG7:17.9-19.1 Mb) the older grape copies hold a fifth and a sixth
// of the ortholog's pairs, and the next contig a fourteenth.
export const COPY_SHARE = 0.1

/**
 * What one lane is, `rows.field`: a genome, or with `refName` one contig of a
 * genome holding a copy of the anchor window, a polyploid's homoeolog or an
 * old duplication's ohnolog, or with `piece` each stretch of a contig the
 * window places, so a haplotype in several pieces draws every one.
 */
export const LANE_ROWS_FIELDS = ['assembly', 'refName', 'piece'] as const
export type LaneRowsField = (typeof LANE_ROWS_FIELDS)[number]

export function readsCopies(field: LaneRowsField) {
  return field !== 'assembly'
}

/** `rows.field` as written, `auto` choosing by the track's genomes */
export const LANE_ROWS_SETTINGS = ['auto', ...LANE_ROWS_FIELDS] as const
export type LaneRowsSetting = (typeof LANE_ROWS_SETTINGS)[number]

/**
 * What one lane is under `setting`. `auto` draws a lane per piece where the
 * source's header declares haplotype lanes, since a haplotype's further
 * pieces are its own sequence over the window; else a lane per copy where the
 * track's genomes name at most one besides the anchor: every gutter already
 * reads against the anchor, and the copies are what the track is opened to
 * see. Across more genomes, or a track naming none, a lane per genome.
 */
export function laneFieldOf(
  setting: LaneRowsSetting,
  trackGenomes: readonly string[],
  isAnchor: (assemblyName: string) => boolean,
  haplotypeLanes = false,
): LaneRowsField {
  return setting === 'auto'
    ? haplotypeLanes
      ? 'piece'
      : trackGenomes.length > 0 &&
          trackGenomes.filter(name => !isAnchor(name)).length <= 1
        ? 'refName'
        : 'assembly'
    : setting
}

/**
 * A copy lane's name, as a locstring names a contig with its assembly:
 * `{grape}chr9`, and a piece lane's, the first base of the contig its piece
 * places, in brackets no contig name holds: `{HG00097.1}CM094061.1[21912395]`.
 * A genome lane's name is its assembly name.
 */
export function copyLaneName(
  assemblyName: string,
  refName: string,
  piece?: number,
) {
  return `{${assemblyName}}${refName}${piece === undefined ? '' : `[${piece}]`}`
}

const COPY_LANE = /^\{([^}]+)\}(.+?)(?:\[(\d+)\])?$/

/** the genome a lane draws, the contig where it is a copy or piece lane, and a piece lane's first base */
export function laneOf(lane: string): {
  assemblyName: string
  refName?: string
  piece?: number
} {
  const match = COPY_LANE.exec(lane)
  return match
    ? {
        assemblyName: match[1]!,
        refName: match[2]!,
        ...(match[3] === undefined ? {} : { piece: Number(match[3]) }),
      }
    : { assemblyName: lane }
}

export function isPieceLane(lane: string) {
  return laneOf(lane).piece !== undefined
}

export function laneGenome(lane: string) {
  return laneOf(lane).assemblyName
}

export function isCopyLane(lane: string) {
  return laneOf(lane).refName !== undefined
}

export interface LaneAssemblies {
  getCanonicalAssemblyName: (name: string) => string | undefined
  has: (name: string) => boolean
  get: (
    name: string,
  ) => { getCanonicalRefName2: (refName: string) => string } | undefined
  getDisplayName: (name: string) => string
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
  const { assemblyName, refName, piece } = laneOf(lane)
  const genome = genomeKey(assemblyName)
  return refName === undefined
    ? genome
    : copyLaneName(genome, refNameKey(genome, refName), piece)
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

interface RefSpan {
  refName: string
  start: number
  end: number
}

/** whether `span` overlaps one of `window`'s regions */
export function touchesWindow(window: readonly RefSpan[], span: RefSpan) {
  return window.some(
    w =>
      w.refName === span.refName &&
      doesIntersect2(w.start, w.end, span.start, span.end),
  )
}

/**
 * `CopyLaneFiling.inWindow` over the regions a view shows, the display's and
 * the export's alike: whether `blocks` hold a group's anchor, its refName
 * spelled as `canon` spells the blocks'
 */
export function anchorInBlocks(
  blocks: readonly RefSpan[],
  canon: (refName: string) => string,
) {
  return ({ anchor }: MultiWayGroup) =>
    touchesWindow(blocks, { ...anchor, refName: canon(anchor.refName) })
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
 * paralog hit, not a copy, and draws no lane unless `chosen` names it; such a
 * lane is `underFloor`, which the lane dialog offers unticked. A mate on the
 * anchor's own contig files nowhere; one on another contig of the anchor's
 * genome is a copy like any other. Only the groups `inWindow` shows weigh
 * against the floor.
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
  const placed = new Set(filed.flatMap(({ mates }) => [...mates.keys()]))
  return {
    groups: filed.map(({ group, mates }) => ({
      ...group,
      mates: new Map([...mates].filter(([lane]) => drawn(lane))),
    })),
    underFloor: [...placed].filter(lane => !drawn(lane)),
  }
}

/** each lane the groups place, once */
export function lanesPlacedIn(groups: readonly MultiWayGroup[]) {
  return new Set(groups.flatMap(group => [...group.mates.keys()]))
}

/**
 * `groups` with each mate filed under the lane of its genome, contig and
 * block, a block named by its first base, which a pan keeps: a contig's
 * placements parted a window apart, `unitBp`, as a lane's frame parts them,
 * a record's pieces never parted (`blocksOf`), and no share floor, so every
 * piece the window places draws. A block no group `inWindow` places draws no
 * lane.
 */
export function fileUnderPieces(
  groups: readonly MultiWayGroup[],
  unitBp: number,
  inWindow: (group: MultiWayGroup) => boolean = () => true,
) {
  const contigs = new Map<
    string,
    {
      assemblyName: string
      refName: string
      placed: { placement: MatePlacement; weight: number; shown: boolean }[]
    }
  >()
  for (const group of groups) {
    const shown = inWindow(group)
    for (const [assemblyName, placements] of group.mates) {
      for (const placement of placements) {
        const key = copyLaneName(assemblyName, placement.refName)
        let contig = contigs.get(key)
        if (!contig) {
          contig = { assemblyName, refName: placement.refName, placed: [] }
          contigs.set(key, contig)
        }
        contig.placed.push({ placement, weight: group.weight, shown })
      }
    }
  }
  const laneOfPlacement = new Map<MatePlacement, string>()
  for (const { assemblyName, refName, placed } of contigs.values()) {
    const blocks =
      unitBp > 0
        ? blocksOf(placed, unitBp, undefined, {
            floor: false,
            joinOf: p => p.placement.feature.get('recordId'),
          })
        : [extentOf(placed)]
    const meets = (
      block: { lo: number; hi: number },
      { placement }: (typeof placed)[number],
    ) => placement.end >= block.lo && placement.start <= block.hi
    const shownBlocks = blocks.filter(block =>
      placed.some(p => p.shown && meets(block, p)),
    )
    for (const p of placed) {
      const block = shownBlocks.find(b => meets(b, p))
      if (block) {
        laneOfPlacement.set(
          p.placement,
          copyLaneName(assemblyName, refName, Math.round(block.lo)),
        )
      }
    }
  }
  return groups.map(group => {
    const mates = new Map<string, MatePlacement[]>()
    for (const placements of group.mates.values()) {
      for (const p of placements) {
        const lane = laneOfPlacement.get(p)
        if (lane !== undefined) {
          const filed = mates.get(lane)
          if (filed) {
            filed.push(p)
          } else {
            mates.set(lane, [p])
          }
        }
      }
    }
    return { ...group, mates }
  })
}

/**
 * The groups `rows.field` draws, the display's and the export's alike: each
 * mate under its genome's lane, under its copy lane as `filing` files it,
 * with the copy lanes the floor drops, or under its piece lane
 */
export function groupsOfField(
  field: LaneRowsField,
  grouped: MultiWayGroup[],
  filing: () => CopyLaneFiling,
  unitBp = 0,
) {
  return field === 'refName'
    ? fileUnderCopies(grouped, filing())
    : field === 'piece'
      ? {
          groups: fileUnderPieces(grouped, unitBp, filing().inWindow),
          underFloor: [],
        }
      : { groups: grouped, underFloor: [] }
}
