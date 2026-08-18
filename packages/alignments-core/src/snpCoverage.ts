/**
 * SNP coverage segments — the stacked A/C/G/T/N slices drawn inside each
 * position's depth bar — written straight into the packed instance buffer the
 * shader and the Canvas2D draw read.
 *
 * The buffer IS the representation, the same move `computeInterbaseCoverage`
 * made next door: there is no parallel-typed-array form of these segments any
 * more. They used to be built as five arrays and then copied into a 20-byte
 * stride buffer, and only the buffer was ever shipped or read
 * (`buildCoverageResultFields`), so the arrays were a second spelling of every
 * record that existed for the length of one pack call.
 * `snpSegments.ts` is the decode side, used by tests.
 *
 * Groups mismatches by position, counts A/C/G/T (and N/other as one grey
 * bucket) per position, and emits stacked segments expressed as fractions of
 * THIS position's coverage bar. colorType: 1=A 2=C 3=G 4=T 5=N.
 *
 * Consumes the flat `mismatchPositions`/`mismatchBases` arrays directly (the
 * same arrays the frequency pass reads) rather than an object array, so callers
 * don't hold a second `{position, base}[]` representation of the same
 * mismatches.
 */
import {
  INSTANCE_OFFSET_F32 as SNP_F32,
  INSTANCE_OFFSET_U32 as SNP_U32,
  INSTANCE_STRIDE_BYTES as SNP_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

// Lane index, i.e. colorType - 1. Lane 4 is the single grey bucket for N and
// the IUPAC ambiguity codes. Shared with the tooltip snap's per-allele gate
// (`findSignificantInBin`), which has to bucket a position exactly the way the
// segments it is asking about were built.
export function snpLaneOf(base: number | undefined) {
  return base === 65
    ? 0
    : base === 67
      ? 1
      : base === 71
        ? 2
        : base === 84
          ? 3
          : 4
}

// Set bits in a 5-lane mask. A table rather than a shift loop because the count
// pass runs it once per distinct position, and at long-read error rates that is
// once per bp of the window.
const LANES_SET = Uint8Array.from({ length: 32 }, (_, m) => {
  let n = 0
  for (let bit = 0; bit < 5; bit++) {
    n += (m >> bit) & 1
  }
  return n
})

function emptyResult() {
  return { snpPackedBuffer: new ArrayBuffer(0), segmentCount: 0 }
}

/**
 * The zero-segment result, for the paths that skip the coverage band entirely.
 *
 * Allocated fresh per call rather than shared: the worker transfers this
 * buffer, which detaches it, so a module-level singleton would throw
 * DataCloneError on the second RPC reply.
 */
export function emptySnpCoverage() {
  return emptyResult()
}

/**
 * `mismatchPositions` MUST arrive ascending, which both producers guarantee:
 * `buildMismatchArrays` sorts in the worker (pinned by `mismatchOrder.test.ts`,
 * and the coverage hit test binary-searches the same array) and MAF's
 * `MismatchWriter.finish` sorts on the way out. Equal positions are therefore
 * contiguous, so grouping is a run-walk over the mismatches and five scratch
 * counters — no per-bp structure at all.
 *
 * That is the whole point. This used to bucket into `new Uint32Array(window * 5)`,
 * 20 bytes per bp of the coverage window and 5x the per-bp depth array, which
 * made it the largest transient in the coverage pipeline. The allocation cost
 * the region's width no matter how few mismatches were in it — the regime a
 * zoomed-out pileup and every MAF region are in — and the fill walked
 * [minOffset, maxOffset], which one mismatch near each end widens back to the
 * whole window.
 *
 * Measured on identical output in `benches/coverageBand.bench.ts`: a 500 kb
 * window carrying 5k mismatches runs 0.6ms -> 0.25ms and drops a 10 MB
 * allocation. A window whose every bp carries a mismatch (300k over 200 kb,
 * i.e. runs of 1.5, where the lane array was nearly full and grouping by index
 * cost nothing) is a wash — the two arms swap places run to run, inside a
 * spread the control shows is noise.
 *
 * A position left of the coverage window, or at zero depth, hosts no SNPs and
 * emits no segment, so out-of-window mismatches drop out without an explicit
 * filter.
 *
 * Output is position order, then lane order — which is what the input's
 * ordering buys, and what the SVG-export snapshots record, a painter emitting
 * one `<rect>` per segment in the order it reads them. Position order also does
 * not vary with read arrival, and where two adjacent sub-pixel columns are
 * widened to the 1px floor and overlap, it paints them consistently left to
 * right.
 */
export function computeSNPCoverage(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
) {
  const {
    depths: coverageDepths,
    maxDepth,
    startPos: coverageStartPos,
  } = coverage
  const len = mismatchPositions.length
  if (len === 0 || maxDepth === 0) {
    return emptyResult()
  }

  const windowLength = coverageDepths.length

  // Count pass: the buffer is sized exactly and filled by index, so the segment
  // count has to be known first. A run contributes one segment per lane it
  // touches, which a 5-bit mask answers without the counters.
  let segmentCount = 0
  let i = 0
  while (i < len) {
    const position = mismatchPositions[i]!
    const offset = position - coverageStartPos
    if (offset >= 0 && offset < windowLength && coverageDepths[offset]! > 0) {
      let mask = 0
      while (i < len && mismatchPositions[i] === position) {
        mask |= 1 << snpLaneOf(mismatchBases[i])
        i++
      }
      segmentCount += LANES_SET[mask]!
    } else {
      while (i < len && mismatchPositions[i] === position) {
        i++
      }
    }
  }

  if (segmentCount === 0) {
    return emptyResult()
  }

  const snpPackedBuffer = new ArrayBuffer(segmentCount * SNP_STRIDE_BYTES)
  const u32 = new Uint32Array(snpPackedBuffer)
  const f32 = new Float32Array(snpPackedBuffer)

  // Indices are inline against the generated per-view offset maps, NOT the
  // generated `setInstance<Field>` accessors: those measured 0.46x on this
  // loop's shape (`benches/instanceAccessors.bench.ts`). The maps still bind
  // each field to a view, one line from the buffer it writes.
  const counts = new Uint32Array(5)
  let s = 0
  i = 0
  while (i < len) {
    const position = mismatchPositions[i]!
    const offset = position - coverageStartPos
    const totalDepth =
      offset >= 0 && offset < windowLength ? coverageDepths[offset]! : 0
    while (i < len && mismatchPositions[i] === position) {
      counts[snpLaneOf(mismatchBases[i])]!++
      i++
    }
    // The counters are cleared lane by lane on the way out rather than with one
    // `counts.fill(0)`, which is a call per run and this loop takes a run per
    // distinct position — at long-read error rates, per bp of the window.
    if (totalDepth > 0) {
      const relDepth = totalDepth / maxDepth
      // Stacked bottom-to-top by accumulating yOffset, which is why the lanes
      // are visited in order.
      let yOffset = 0
      for (let lane = 0; lane < 5; lane++) {
        const n = counts[lane]!
        if (n > 0) {
          counts[lane] = 0
          const height = n / totalDepth
          const o = s++ * SNP_STRIDE
          u32[o + SNP_U32.position] = position
          f32[o + SNP_F32.yOffset] = yOffset
          f32[o + SNP_F32.segHeight] = height
          f32[o + SNP_F32.colorType] = lane + 1
          f32[o + SNP_F32.relDepth] = relDepth
          yOffset += height
        }
      }
    } else {
      counts[0] = 0
      counts[1] = 0
      counts[2] = 0
      counts[3] = 0
      counts[4] = 0
    }
  }

  return { snpPackedBuffer, segmentCount }
}
