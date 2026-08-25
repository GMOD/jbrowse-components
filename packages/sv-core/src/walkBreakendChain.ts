import { parseSvAlt, toCanonicalRefName } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

/**
 * One junction, reduced to what a chain walk needs: where its two ends are, and
 * the two record ids that let the walk tell "the way I came" from "another
 * junction that happens to be here".
 *
 * **Both refNames are canonical**, which `junctionFromFeature` is responsible
 * for and is the only way to build one. Every use here needs them to be: the
 * walk compares one junction's refName against another's, `findJunctionsNear`
 * turns a stop back into an RPC region (whose contract is canonical in, adapter
 * name out — see `renameRegionsIfNeeded`), and `navToMultiLevelBreak` looks a
 * stop up in `assembly.regions`. Raw names fail all three, and only the last one
 * fails loudly.
 */
export interface Junction {
  id?: string
  mateId?: string
  refName: string
  pos: number
  mateRefName: string
  matePos: number
  /**
   * Ids of the caller's assembly contigs supporting this junction — GRIDSS
   * `BEID`, Esvee `ASMID`. Two junctions sharing one were assembled on one
   * contig, i.e. the caller phased them cis, which is the one fact the walk
   * otherwise cannot know at a locus two junctions leave from.
   */
  assemblyIds?: string[]
}

/** A stop on the chain: one panel of the split view. */
export interface ChainStop {
  refName: string
  pos: number
  /** id of the junction crossed to arrive here; undefined for the first stop */
  viaId?: string
}

/**
 * The caller's read of the callset the starting record came from. Supplying one
 * is what opts an entry point into chain walking, so a launch site with no way
 * to query the track (a read's SA mate, a spreadsheet row) simply opens the two
 * ends it does know.
 */
export type FindJunctionsNear = (region: {
  refName: string
  start: number
  end: number
}) => Promise<Junction[]>

/**
 * How close two breakends have to be to count as the same place.
 *
 * NOT the same number as the reconstruction's junction tolerance (20 bp, which
 * asks whether two READS describe one junction). This asks whether two DIFFERENT
 * junctions leave from one locus, and they leave from either side of whatever
 * short piece of sequence the rearrangement kept there, so the gap is the piece
 * and not caller jitter. Measured on the COLO829 nanomonsv calls, whose der(3)
 * is a closed chr3-chr10-chr12 triangle: 198 bp between the two chr10
 * breakends, 182 bp between the two chr12 ones, 457 bp between the two chr3
 * ones. 1 kb covers those with room and is still far below the 5 kb window a
 * panel defaults to, so a hop always lands inside the panel it came from.
 */
export const BREAKEND_COLOCATION_BP = 1000

/**
 * The junction a VCF SV/BND feature describes, or undefined when it names no
 * mate position (a single breakend, or a symbolic ALT with no END).
 *
 * The assembly is what makes this the single place a `Junction` can come from.
 * Neither refName reaching here is canonical: the mate's is whatever text the
 * ALT spells (`G[A:34200[` → `A`), and the record's own is the *adapter's*,
 * since a fetch renames the query region into the file's names on the way out
 * and nothing renames the features on the way back. So both sides need the same
 * resolution `getBreakendCoveringRegions` has always applied, and doing it here
 * is what keeps two producers of the same chain from disagreeing about which
 * names they speak.
 */
export function junctionFromFeature(
  feature: Feature,
  assembly: Assembly,
): Junction | undefined {
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const parsed = parseSvAlt(feature, alt)
  if (!parsed) {
    return undefined
  }
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const mateId = (info?.MATEID as string[] | undefined)?.[0]
  const assemblyIds = [
    ...((info?.BEID as string[] | undefined) ?? []),
    ...((info?.ASMID as string[] | undefined) ?? []),
  ]
  const f = toCanonicalRefName(assembly)
  return {
    id: feature.get('name'),
    ...(mateId !== undefined && { mateId }),
    ...(assemblyIds.length > 0 && { assemblyIds }),
    refName: f(feature.get('refName')),
    pos: feature.get('start'),
    mateRefName: f(parsed.mateRefName),
    // parseSvAlt reports the VCF 1-based coordinate; every position here is
    // 0-based, the way getBreakendCoveringRegions hands them to the panels.
    matePos: parsed.matePos - 1,
  }
}

function near(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance
}

function sameLocus(
  a: { refName: string; pos: number },
  b: { refName: string; pos: number },
  tolerance: number,
) {
  return a.refName === b.refName && near(a.pos, b.pos, tolerance)
}

/**
 * The locus a stop was reached FROM: the end of the arrival junction that is not
 * this stop.
 *
 * A junction is reachable from either end, so which of its two ends the walk
 * came in on is a fact about the HOP and not about the record — and reading it
 * off the record is where this went wrong. It compared against `arrivedBy`'s
 * first end unconditionally, so on a hop taken through the junction's mate end
 * that first end IS the current stop, and a guard meant to refuse the way back
 * asked instead whether a candidate looped onto the stop it left. It therefore
 * worked in one traversal direction and silently did nothing in the other, and
 * the direction is decided by which spelling of a reciprocal pair the callset
 * happened to file first.
 */
function arrivedFrom(
  arrivedBy: Junction,
  stop: { refName: string; pos: number },
  tolerance: number,
) {
  const mateEnd = { refName: arrivedBy.mateRefName, pos: arrivedBy.matePos }
  return sameLocus(arrivedBy, stop, tolerance)
    ? mateEnd
    : { refName: arrivedBy.refName, pos: arrivedBy.pos }
}

/**
 * Which junction the chain leaves this stop by, given every junction with an end
 * at it. Pure, and the whole of the walk's judgment.
 *
 * Returns `undefined` — i.e. the chain ends here — in three cases, and each is a
 * deliberate refusal rather than a missing feature:
 *
 * - **nothing else is here.** The stop is the end of the rearrangement as the
 *   caller described it.
 * - **the only continuation goes back somewhere the chain has already been.**
 *   That is a closed cycle, which the COLO829 der(3) is: chr3 to chr10 to chr12
 *   and the third junction returns to chr3. Following it would add a fourth
 *   panel of a locus panel one already shows.
 * - **more than one junction leaves this stop.** Two continuations mean the
 *   records cannot say which molecule carries which, and picking the closer or
 *   the better-supported one would be this code inventing an answer the caller
 *   declined to give. A reader who wants that comparison has the reads, via
 *   Reconstruct derivative allele, which ranks routes by how many molecules take
 *   each.
 *
 * The exception to the third is a caller that did not decline: when exactly one
 * of the continuations shares an assembly contig with the junction the walk
 * arrived by (`assemblyIds`), the caller assembled one contig across both, and
 * that is the answer taken.
 */
export function nextJunctionFrom({
  stop,
  arrivedBy,
  candidates,
  visited,
  tolerance = BREAKEND_COLOCATION_BP,
}: {
  stop: { refName: string; pos: number }
  /** the junction crossed to reach `stop`, whose own record is not a way onward */
  arrivedBy?: Junction
  /** every junction with an end near `stop`, in any order */
  candidates: Junction[]
  /** stops already on the chain, `stop` included */
  visited: { refName: string; pos: number }[]
  tolerance?: number
}): { junction: Junction; next: { refName: string; pos: number } } | undefined {
  // A junction is reachable from either end, so each candidate is first turned
  // around to leave from `stop`.
  const onward = candidates.flatMap(j => {
    const fromThisEnd = sameLocus(j, stop, tolerance)
    const fromMateEnd = sameLocus(
      { refName: j.mateRefName, pos: j.matePos },
      stop,
      tolerance,
    )
    const next = fromThisEnd
      ? { refName: j.mateRefName, pos: j.matePos }
      : fromMateEnd
        ? { refName: j.refName, pos: j.pos }
        : undefined
    return next === undefined ? [] : [{ junction: j, next }]
  })

  const arrivalIds = new Set(
    [arrivedBy?.id, arrivedBy?.mateId].filter(id => id !== undefined),
  )
  // `visited` holds this locus too, to within the tolerance of whatever
  // coordinate the previous hop recorded — so the guard below only earns its
  // place for a candidate sitting past that: one junction filed twice a
  // kilobase apart, which is what merging two callers gives.
  const cameFrom =
    arrivedBy === undefined
      ? undefined
      : arrivedFrom(arrivedBy, stop, tolerance)
  const fresh = onward.filter(
    o =>
      // not the record we arrived on, nor its own mate record: a reciprocal
      // pair is one junction written twice and both spellings sit at this locus
      (o.junction.id === undefined || !arrivalIds.has(o.junction.id)) &&
      // and not a second copy of the arrival junction filed under other ids,
      // which is what a callset with no MATEID gives instead
      (cameFrom === undefined || !sameLocus(o.next, cameFrom, tolerance)),
  )
  const open = fresh.filter(
    o => !visited.some(v => sameLocus(o.next, v, tolerance)),
  )
  // Ambiguity is measured over DESTINATIONS, not over records. A reciprocal pair
  // is one junction written twice, so both spellings are here and both lead to
  // the same next locus: counted as records that is two ways onward and the walk
  // stops, which on the COLO829 triangle lost chr12 to a junction it had
  // correctly found. Counted as places it is one.
  //
  // Ambiguity is also measured over what is genuinely OPEN. A branch that only
  // leads back into the chain is not a second answer, so a closed cycle must not
  // read as "too many ways onward" either.
  const destinations: typeof open = []
  for (const o of open) {
    if (!destinations.some(d => sameLocus(d.next, o.next, tolerance))) {
      destinations.push(o)
    }
  }
  if (destinations.length === 1) {
    return destinations[0]
  }
  const arrivalContigs = new Set(arrivedBy?.assemblyIds ?? [])
  const phased = destinations.filter(d =>
    open.some(
      o =>
        sameLocus(o.next, d.next, tolerance) &&
        (o.junction.assemblyIds ?? []).some(id => arrivalContigs.has(id)),
    ),
  )
  return phased.length === 1 ? phased[0] : undefined
}

/**
 * Walk a chain of co-located junctions outward from one, and return the stops a
 * breakpoint split view should show. Always at least two: the record's own two
 * ends.
 *
 * `findJunctionsNear` is the caller's read of the same callset the starting
 * record came from — the walk does no fetching of its own, which is what keeps
 * `nextJunctionFrom` a pure decision the tests can hold.
 *
 * OUTWARD MEANS BOTH WAYS, and it did not. The walk only ever extended past the
 * record's MATE end, so which of a chain's records a reader clicked decided how
 * much of the chain they were shown: on a four-locus chromoplexy the first
 * record returns all four panels and the last returns two, with nothing saying
 * a shorter answer was the shorter one. Every record of an event is equally the
 * event, so the walk now also extends past the record's own end and puts those
 * stops in front. A closed cycle is unaffected — COLO829's der(3) triangle
 * comes back the way round it always did, because the backward step's only
 * candidate leads to a locus the forward walk already has.
 *
 * Forward first, so the budget below is spent the way it always was whenever
 * the forward walk alone can fill it.
 *
 * Bounded by `maxStops` because the input is somebody's VCF: a callset dense in
 * breakends within a kilobase of each other (an amplicon, a chromothriptic
 * shard) is a chain the walk can follow much further than a reader can take in,
 * and every stop is another panel dividing the same viewport height.
 */
export async function walkBreakendChain({
  start,
  findJunctionsNear,
  tolerance = BREAKEND_COLOCATION_BP,
  maxStops = 4,
}: {
  start: Junction
  findJunctionsNear: FindJunctionsNear
  tolerance?: number
  maxStops?: number
}): Promise<ChainStop[]> {
  const stops: ChainStop[] = [
    { refName: start.refName, pos: start.pos },
    { refName: start.mateRefName, pos: start.matePos, viaId: start.id },
  ]
  // `viaId` is which junction was crossed to ARRIVE at a stop, reading the list
  // top to bottom — so a stop added to the front takes over the one in front of
  // it, and the new head has nothing above it to have been reached from.
  const extend = async (backwards: boolean) => {
    let arrivedBy = start
    while (stops.length < maxStops) {
      const stop = backwards ? stops[0]! : stops.at(-1)!
      const candidates = await findJunctionsNear({
        refName: stop.refName,
        start: Math.max(0, stop.pos - tolerance),
        end: stop.pos + tolerance,
      })
      const hop = nextJunctionFrom({
        stop,
        arrivedBy,
        candidates,
        visited: stops,
        tolerance,
      })
      if (!hop) {
        break
      }
      if (backwards) {
        stop.viaId = hop.junction.id
        stops.unshift({ ...hop.next })
      } else {
        stops.push({ ...hop.next, viaId: hop.junction.id })
      }
      arrivedBy = hop.junction
    }
  }
  await extend(false)
  await extend(true)
  return stops
}
