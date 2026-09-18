import { junctionEnds, toCanonicalRefName } from './util.ts'

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
  /** which way the sequence each end keeps runs: 1 right, -1 left, 0 unknown */
  keeps?: number
  mateKeeps?: number
  /** the caller's FILTER rejected the record, so it is no way onward */
  filtered?: boolean
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
 * The junction an SV record describes, or undefined when it names no other end
 * (a single breakend, a symbolic ALT with no END, a plain SNV). Both ends come
 * from `junctionEnds`, the resolver the split-view launchers use, so a walk
 * and a launch put a record's panels at the same coordinates.
 *
 * Neither refName reaching here is canonical — the mate's is the ALT's
 * spelling, the record's own is the adapter's — so both are resolved through
 * the assembly, which makes this the single place a `Junction` can come from.
 *
 * `id` is the VCF ID only where MATEID pairs records by it. Anywhere else a
 * name is not unique — rows of a BEDPE left at `.`, two STAR-Fusion rows of
 * one gene pair — and a shared one made every candidate read as the record
 * the walk arrived on.
 */
export function junctionFromFeature(
  feature: Feature,
  assembly: Assembly,
): Junction | undefined {
  const ends = junctionEnds(feature)
  if (!ends) {
    return undefined
  }
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const mateId = (info?.MATEID as string[] | undefined)?.[0]
  const assemblyIds = [
    ...((info?.BEID as string[] | undefined) ?? []),
    ...((info?.ASMID as string[] | undefined) ?? []),
  ]
  const filter = feature.get('FILTER') as string | string[] | undefined
  const f = toCanonicalRefName(assembly)
  return {
    id: mateId === undefined ? feature.id() : feature.get('name'),
    ...(mateId !== undefined && { mateId }),
    ...(assemblyIds.length > 0 && { assemblyIds }),
    ...([filter ?? []].flat().some(v => v !== 'PASS' && v !== '.') && {
      filtered: true,
    }),
    refName: f(ends.own.refName),
    pos: ends.own.pos,
    keeps: ends.own.keeps,
    mateRefName: f(ends.mate.refName),
    matePos: ends.mate.pos,
    mateKeeps: ends.mate.keeps,
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

interface JunctionEndAt {
  pos: number
  keeps: number
}

// The end of `j` at `stop`: stops are built from junction ends, so it is the
// nearer of the two.
function endAt(j: Junction, stop: { refName: string; pos: number }) {
  const distance = (refName: string, pos: number) =>
    refName === stop.refName ? Math.abs(pos - stop.pos) : Infinity
  return distance(j.refName, j.pos) <= distance(j.mateRefName, j.matePos)
    ? { pos: j.pos, keeps: j.keeps ?? 0 }
    : { pos: j.matePos, keeps: j.mateKeeps ?? 0 }
}

// How far the two junctions bounding a segment may overlap and still be one
// molecule's: breakpoint placement and junction microhomology run to a few
// dozen bases.
const JUNCTION_OVERLAP_BP = 50

// Whether a molecule that arrived at a locus by `arrival` can leave it by
// `leaves`. It runs along the reference from the arrival end the way that end
// keeps, so the departing end has to keep the opposite way — face back at it —
// and sit on the arrival's kept side. An end whose kept side is unknown is not
// held to either.
function continues(arrival: JunctionEndAt, leaves: JunctionEndAt) {
  return (
    arrival.keeps === 0 ||
    leaves.keeps === 0 ||
    (leaves.keeps === -arrival.keeps &&
      (leaves.pos - arrival.pos) * arrival.keeps >= -JUNCTION_OVERLAP_BP)
  )
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
 * worked in one traversal direction and refused nothing in the other, and
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
 *   declined to give. The reads in the panels are the evidence a reader weighs
 *   instead.
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
    const leaves = fromThisEnd
      ? { pos: j.pos, keeps: j.keeps ?? 0 }
      : { pos: j.matePos, keeps: j.mateKeeps ?? 0 }
    return next === undefined ? [] : [{ junction: j, next, leaves }]
  })
  const arrival = arrivedBy === undefined ? undefined : endAt(arrivedBy, stop)

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
      o.junction.filtered !== true &&
      (arrival === undefined || continues(arrival, o.leaves)) &&
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
 * record came from. The walk does no fetching, so `nextJunctionFrom` stays a
 * pure decision the tests can hold.
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
 * **Going both ways is only as good as what `findJunctionsNear` answers with.**
 * A hop needs a record with an END at the stop, and a coordinate-indexed query
 * hands back the records filed AT it — so a callset that writes each junction
 * once, at one of its two ends, extends only as far as it happens to have filed
 * records at loci the walk has already reached. Measured on a four-locus chain
 * written one record per junction: 4 stops from the first record, 3 from the
 * second, 2 from the third. What supplies the missing spelling is a reciprocal
 * BND pair (which is how VCF 4.x writes a breakend, and what every caller in
 * the tree emits) or an adapter that files a row under both of its contigs
 * (`BedpeAdapter`, `StarFusionAdapter`). What has neither is a filtered VCF
 * missing one mate, or a single-record `<TRA>` naming CHR2 — see
 * `makeFindJunctionsNear` for why no query can rescue those.
 *
 * A reader that is not coordinate-indexed has none of this. The SV inspector's
 * sheet holds the whole parsed callset in memory and matches a window against
 * BOTH ends of every junction, so the same four-locus chain returns 4 stops
 * from any of its records — see `SpreadsheetModel`'s `findJunctionsNear`.
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
