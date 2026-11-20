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

interface LaneAssemblies {
  getCanonicalAssemblyName: (name: string) => string | undefined
  has: (name: string) => boolean
  get: (
    name: string,
  ) => { getCanonicalRefName2: (refName: string) => string } | undefined
}

/**
 * The canonical name, so two spellings of one lane share a key: a copy lane's
 * assembly and refName each canonical, where the session holds its genome
 */
export function laneKeyIn(assemblyManager: LaneAssemblies, lane: string) {
  const { assemblyName, refName } = laneOf(lane)
  const genome =
    assemblyManager.getCanonicalAssemblyName(assemblyName) ?? assemblyName
  return refName === undefined
    ? genome
    : copyLaneName(
        genome,
        (assemblyManager.has(genome) &&
          assemblyManager.get(genome)?.getCanonicalRefName2(refName)) ||
          refName,
      )
}

/**
 * `groups` with each mate filed under its contig's copy lane. A contig holding
 * under `COPY_SHARE` of its genome's heaviest contig's evidence is a stray
 * paralog hit, not a copy, and draws no lane unless `chosen` names it.
 */
export function fileUnderCopies(
  groups: readonly MultiWayGroup[],
  chosen: (lane: string) => boolean = () => false,
) {
  const evidence = new Map<string, Map<string, number>>()
  for (const group of groups) {
    for (const [assemblyName, placements] of group.mates) {
      const byContig = evidence.get(assemblyName) ?? new Map<string, number>()
      evidence.set(assemblyName, byContig)
      for (const { refName } of placements) {
        byContig.set(refName, (byContig.get(refName) ?? 0) + group.weight)
      }
    }
  }
  const floor = new Map(
    [...evidence].map(([assemblyName, byContig]) => [
      assemblyName,
      Math.max(...byContig.values()) * COPY_SHARE,
    ]),
  )
  return groups.map(group => {
    const mates = new Map<string, MatePlacement[]>()
    for (const [assemblyName, placements] of group.mates) {
      const byContig = evidence.get(assemblyName)!
      const min = floor.get(assemblyName)!
      for (const p of placements) {
        const lane = copyLaneName(assemblyName, p.refName)
        if (byContig.get(p.refName)! >= min || chosen(lane)) {
          mates.set(lane, [...(mates.get(lane) ?? []), p])
        }
      }
    }
    return { ...group, mates }
  })
}
