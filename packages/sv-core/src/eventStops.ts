import type { Junction } from './walkBreakendChain.ts'

/**
 * A rearrangement event as its caller grouped it: the value of the record's
 * `EVENT`, and every junction carrying that value.
 */
export interface SvEvent {
  label: string
  junctions: Junction[]
}

function junctionKey(j: Junction) {
  const ends =
    j.mateId === undefined
      ? [`${j.refName}:${j.pos}`, `${j.mateRefName}:${j.matePos}`]
      : [`${j.id}`, j.mateId]
  return ends.sort((a, b) => a.localeCompare(b)).join('|')
}

/**
 * One junction per mate pair. A BND callset writes each junction twice, once
 * from either end, and GRIDSS gives the two records one `EVENT`: counting
 * records would make every breakpoint there a two-member event.
 */
export function distinctJunctions(junctions: Junction[]) {
  return [...new Map(junctions.map(j => [junctionKey(j), j])).values()]
}

/**
 * The loci an event visits, one per split-view panel, in `refNameOrder`.
 *
 * Ends within `mergeWithinBp` of each other share a panel, centred between
 * them: the HG008 Severus callset puts the five records of one cluster on two
 * loci, and a panel per breakend would stack one window five times.
 */
export function eventStops(
  junctions: Junction[],
  mergeWithinBp: number,
  refNameOrder: string[],
) {
  const rank = new Map(refNameOrder.map((refName, i) => [refName, i]))
  const ends = distinctJunctions(junctions)
    .flatMap(j => [
      { refName: j.refName, pos: j.pos },
      { refName: j.mateRefName, pos: j.matePos },
    ])
    .sort(
      (a, b) =>
        (rank.get(a.refName) ?? Infinity) - (rank.get(b.refName) ?? Infinity) ||
        a.refName.localeCompare(b.refName) ||
        a.pos - b.pos,
    )
  const loci: { refName: string; min: number; max: number }[] = []
  for (const { refName, pos } of ends) {
    const last = loci.at(-1)
    if (last?.refName === refName && pos - last.max <= mergeWithinBp) {
      last.max = pos
    } else {
      loci.push({ refName, min: pos, max: pos })
    }
  }
  return loci.map(({ refName, min, max }) => ({
    refName,
    pos: Math.round((min + max) / 2),
  }))
}
