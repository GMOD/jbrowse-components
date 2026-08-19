import { SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'

import { isChainData } from '../RenderAlignmentDataRPC/types.ts'
import { chainFrame, chainHasSupp, withChainFrame } from '../shared/types.ts'
import { getOrCreate } from '../shared/util.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

// Sweeps stop as soon as a pass flips nothing, so this only bounds a
// pathological case. Each sweep is one linear walk of the votes, and every flip
// strictly increases the objective below, so the loop terminates on its own —
// the cap is a backstop, not the convergence condition. The COLO829 foldback
// (33 chains, 3 buckets) settles in 3.
const MAX_SWEEPS = 8

// The reads this pass frames: an unpaired segment of a chain that carries a
// supplementary. `chainFrame`/`withChainFrame` then read and write only the
// frame bit of the same byte, so every downstream consumer (the GPU category
// bake, the Canvas2D fill, the legend, the SVG export) is untouched and no split
// bits are disturbed.
//
// This used to enumerate the two enum values that meant "framed", which is a
// membership test standing in for a bit test — and it had to be repeated on all
// four loops below because getting it wrong anywhere would have had the pass
// rewrite a split marker into a frame.
function isFramedUnpairedSplit(fill: number, flags: number) {
  return chainHasSupp(fill) && (flags & SAM_FLAG_PAIRED) === 0
}

interface Seg {
  chain: number
  bucket: number
  start: number
  end: number
  strand: number
}

/**
 * Assign every segment to a locus bucket: a maximal run of segments that
 * overlap, within one displayed region.
 *
 * A bucket is the unit two chains can be compared over — "you and I both have
 * something here, do we point the same way". Overlap runs rather than the region
 * itself, so a wide window holding two distant pileups still poses two separate
 * questions; and per region rather than per refName, because two windows on one
 * chromosome are two questions as well.
 *
 * A bucket never spans two entries of `byLocus`, which is why the caller decides
 * what an entry is (`locusOf`) rather than getting one per map key: chains that
 * share no bucket contribute nothing to the pairwise objective, so grouping
 * lanes arriving as separate keys would silently stop being compared.
 */
function assignBuckets(byLocus: Seg[][]) {
  let next = 0
  for (const segs of byLocus) {
    const order = segs
      .map((_, i) => i)
      .sort((a, b) => segs[a]!.start - segs[b]!.start)
    let end = -1
    for (const i of order) {
      const s = segs[i]!
      if (s.start >= end) {
        next++
        end = s.end
      } else if (s.end > end) {
        end = s.end
      }
      s.bucket = next - 1
    }
  }
  return next
}

/**
 * Each chain's opinion about each bucket, as a purity in [-1, 1]: the aligned
 * length pointing forward minus the length pointing reverse, over the total.
 * Computed on the RAW mapping strand, so it does not move when a frame flips —
 * the framed vote is simply `vote * frame`.
 *
 * The normalization is what makes the pass work, and dropping it makes it do
 * nothing at all. Weighted by raw length instead, one chain's 32 kb arm outvotes
 * every 200 bp insert on screen, and since that arm is also the alignment the
 * aligner called primary, every chain agrees with every other by construction
 * and no flip ever improves anything. Measured on the COLO829 foldback: raw
 * length flips 0 of 33 chains, purity flips 14 and lands every window on one
 * orientation.
 *
 * The same normalization is why a foldback chain abstains where it should. Both
 * of its arms land in one bucket pointing opposite ways, so they cancel toward
 * 0 and the chain says "this locus cannot tell you which way I go" — which is
 * the truth, and is exactly the tie the aligner's primary pick was silently
 * breaking.
 */
function buildVotes(segs: Seg[], numChains: number, numBuckets: number) {
  const fwd = new Map<number, number>()
  const rev = new Map<number, number>()
  for (const s of segs) {
    const key = s.chain * numBuckets + s.bucket
    const m = s.strand < 0 ? rev : fwd
    m.set(key, (m.get(key) ?? 0) + (s.end - s.start))
  }
  const keys = [...new Set([...fwd.keys(), ...rev.keys()])].sort(
    (a, b) => a - b,
  )
  const votes = keys.map(key => {
    const f = fwd.get(key) ?? 0
    const r = rev.get(key) ?? 0
    return {
      chain: Math.floor(key / numBuckets),
      bucket: key % numBuckets,
      v: (f - r) / (f + r),
    }
  })
  const byChain: number[][] = Array.from({ length: numChains }, () => [])
  votes.forEach((_, i) => {
    byChain[votes[i]!.chain]!.push(i)
  })
  return { votes, byChain }
}

/**
 * Choose one frame per chain so that chains agreeing about a locus are painted
 * the same way.
 *
 * The objective is pairwise: for chains a and b, `sum over buckets of
 * (vote_a * frame_a) * (vote_b * frame_b)`, summed over pairs and maximized.
 * Positive means "we saw the same thing pointing the same way". Written that way
 * it is an Ising ground state and NP-hard in general, so this is the mean-field
 * relaxation of it: hold a running total per bucket, and flip any chain that
 * scores negative against the total the others contribute. Each flip strictly
 * increases the objective, and the sweep is sequential (the running total is
 * updated as each chain flips) so it cannot oscillate the way a synchronous
 * majority vote can.
 *
 * The global sign is NOT determined by that objective — negating every frame
 * leaves every product unchanged — so the caller anchors it. See
 * `consensusChainStrandFrames`.
 *
 * A chain seen at ONE bucket is frozen, and that restriction is load-bearing
 * rather than an optimization. Its frame and its mapping strand are the same
 * statement there, so "flip it to agree with the neighbours" is not resolving an
 * ambiguity — it is deleting the read's own orientation and replacing it with
 * the crowd's. Without the freeze every lone segment is absorbed into whatever
 * surrounds it, which erases exactly the inverted supplementary at a breakpoint
 * that this colouring exists to show. Frozen chains still VOTE: they are usually
 * what tells a bucket which way it points.
 */
function solveFrames(
  frames: Int8Array,
  votes: { chain: number; bucket: number; v: number }[],
  byChain: number[][],
  numBuckets: number,
) {
  const totals = new Float64Array(numBuckets)
  for (const { chain, bucket, v } of votes) {
    totals[bucket]! += v * frames[chain]!
  }
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let flipped = 0
    for (let c = 0; c < byChain.length; c++) {
      if (byChain[c]!.length < 2) {
        continue
      }
      let score = 0
      for (const i of byChain[c]!) {
        const { bucket, v } = votes[i]!
        const x = v * frames[c]!
        score += x * (totals[bucket]! - x)
      }
      if (score < 0) {
        for (const i of byChain[c]!) {
          const { bucket, v } = votes[i]!
          totals[bucket]! -= 2 * v * frames[c]!
        }
        frames[c] = -frames[c]!
        flipped++
      }
    }
    if (flipped === 0) {
      break
    }
  }
}

/**
 * Re-answer each unpaired split chain's strand FRAME from the other chains on
 * screen, instead of from the alignment its aligner happened to flag primary.
 *
 * The framing this replaces is `strand * primaryStrand` (colorUtils), and the
 * case it cannot serve is a foldback, where a molecule's two arms align to
 * OVERLAPPING reference in opposite orientations. Both are candidates for
 * "longest alignment", so which one carries the primary flag turns on where the
 * read happened to start, and the frame flips with it. Measured on the COLO829
 * chr3 foldback in the `cancer_sv` tutorial, over the 33 split molecules in the
 * figure's three windows: 19 reads' primary ends at one arm's junction and 14 at
 * the other's, and that split predicts the painted colour with no exceptions —
 * chr10 came out 14 forward / 19 reverse, chr12 18 / 11, i.e. a coin flip. It is
 * not the sequencing direction; `strand * primaryStrand` already cancels that
 * correctly, and both classes hold a mix of forward and reverse primaries.
 *
 * No per-chain rule fixes it, because on a foldback there is no locally
 * identifiable canonical segment — longest alignment IS the primary (58%
 * agreement), first segment along the read 52%, leftmost in the anchor region
 * 61%. Only comparing chains to each other does: this pass takes all three
 * windows to 100%, flipping 14 of the 33.
 *
 * What it deliberately cannot do is collapse a set that genuinely disagrees. A
 * frame is one sign per chain, so a real inversion still paints two colours —
 * which is the point, and is why the chr3 window keeps its red/blue split (each
 * molecule contributes one segment of each arm) while chr10 and chr12 go
 * uniform.
 *
 * Runs after `reconcileChainSuppAcrossRegions`, whose per-chain answer is this
 * one's starting point, and only when `flipStrandLongReadChains` is on and the
 * scheme actually reads the framing (see `framesUnpairedChainStrand`).
 *
 * `locusOf` names which entries share a locus, defaulting to one locus per entry
 * — the single-lane case, where an entry IS a displayed region. A grouped
 * display hands over one entry per (lane, region) and must map them back onto
 * the region, or the lanes at one locus share no bucket and the comparison this
 * pass exists to make never happens between them.
 */
// Generic in the entry type for the reason `reconcileChainSuppAcrossRegions` is.
export function consensusChainStrandFrames<T extends WorkerPileupData>(
  map: Map<number, T>,
  locusOf: (key: number) => number = key => key,
): Map<number, T> {
  const chainIds = new Map<string, number>()
  const byLocus = new Map<number, Seg[]>()
  let numSegs = 0
  for (const [key, data] of map) {
    const segs = getOrCreate(byLocus, locusOf(key), () => [])
    if (!isChainData(data)) {
      continue
    }
    const {
      readChainIndices,
      chainNames,
      readFlags,
      readStrands,
      readPositions,
      readChainHasSupp,
    } = data
    for (let i = 0; i < readChainIndices.length; i++) {
      if (!isFramedUnpairedSplit(readChainHasSupp[i]!, readFlags[i]!)) {
        continue
      }
      const name = chainNames[readChainIndices[i]!]!
      let id = chainIds.get(name)
      if (id === undefined) {
        id = chainIds.size
        chainIds.set(name, id)
      }
      segs.push({
        chain: id,
        bucket: 0,
        start: readPositions[i * 2]!,
        end: readPositions[i * 2 + 1]!,
        strand: readStrands[i]!,
      })
      numSegs++
    }
  }
  // One chain has nobody to agree with, and one segment per chain carries no
  // relative orientation at all.
  if (chainIds.size < 2 || numSegs < 2) {
    return map
  }

  const loci = [...byLocus.values()]
  const numBuckets = assignBuckets(loci)
  const all = loci.flat()
  const frames = new Int8Array(chainIds.size).fill(1)
  for (const data of map.values()) {
    if (!isChainData(data)) {
      continue
    }
    for (let i = 0; i < data.readChainIndices.length; i++) {
      const fill = data.readChainHasSupp[i]!
      if (!isFramedUnpairedSplit(fill, data.readFlags[i]!)) {
        continue
      }
      const id = chainIds.get(data.chainNames[data.readChainIndices[i]!]!)
      if (id !== undefined) {
        frames[id] = chainFrame(fill)
      }
    }
  }
  const seeded = Int8Array.from(frames)

  const { votes, byChain } = buildVotes(all, chainIds.size, numBuckets)
  solveFrames(frames, votes, byChain, numBuckets)

  // Anchor the global sign, which the objective leaves free: keep whichever
  // orientation the majority of chains already had from their own primary. Only
  // a strict majority inverts, so a tie holds still. Without this the whole
  // pileup could swap red for blue between two renders of identical data — the
  // solver is deterministic, but "all frames negated" is an equally optimal
  // answer and nothing else would pick between them.
  let changed = 0
  for (let c = 0; c < frames.length; c++) {
    if (frames[c] !== seeded[c]) {
      changed++
    }
  }
  if (changed * 2 > frames.length) {
    for (let c = 0; c < frames.length; c++) {
      frames[c] = -frames[c]!
    }
  }

  const out = new Map<number, T>()
  for (const [idx, data] of map) {
    if (!isChainData(data)) {
      out.set(idx, data)
      continue
    }
    const { readChainIndices, chainNames, readFlags, readChainHasSupp } = data
    const merged = new Uint8Array(readChainHasSupp)
    let dirty = false
    for (let i = 0; i < readChainIndices.length; i++) {
      const fill = readChainHasSupp[i]!
      if (!isFramedUnpairedSplit(fill, readFlags[i]!)) {
        continue
      }
      const id = chainIds.get(chainNames[readChainIndices[i]!]!)
      if (id === undefined) {
        continue
      }
      const next = withChainFrame(fill, frames[id]!)
      merged[i] = next
      dirty = dirty || next !== fill
    }
    // Reference identity matters downstream (the renderer's upload memo reads
    // it), so a region the consensus agreed with keeps its own array.
    out.set(idx, dirty ? { ...data, readChainHasSupp: merged } : data)
  }
  return out
}
