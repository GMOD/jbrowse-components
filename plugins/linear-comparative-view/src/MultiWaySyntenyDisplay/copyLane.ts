import type { MatePlacement, MultiWayGroup } from './layoutMultiWay.ts'

// well under the switch margin, so a copy a genome lane never picks is still
// named, and a copy lane is still drawn
export const ALSO_ON_SHARE = 0.2

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

/**
 * `groups` with each mate filed under its contig's copy lane. A contig holding
 * under `ALSO_ON_SHARE` of its genome's heaviest contig's evidence is a stray
 * paralog hit, not a copy: it draws no lane, as a genome lane's header leaves
 * it unnamed.
 */
export function fileUnderCopies(groups: readonly MultiWayGroup[]) {
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
      Math.max(...byContig.values()) * ALSO_ON_SHARE,
    ]),
  )
  return groups.map(group => {
    const mates = new Map<string, MatePlacement[]>()
    for (const [assemblyName, placements] of group.mates) {
      const byContig = evidence.get(assemblyName)!
      const min = floor.get(assemblyName)!
      for (const p of placements) {
        if (byContig.get(p.refName)! >= min) {
          const lane = copyLaneName(assemblyName, p.refName)
          mates.set(lane, [...(mates.get(lane) ?? []), p])
        }
      }
    }
    return { ...group, mates }
  })
}
