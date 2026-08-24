/**
 * The four coverage-band buffers a producer packs per region, in the layouts
 * `coverageBand.slang`'s passes read. Every field is filled by
 * `@jbrowse/alignments-core` — `packCoverageBinsForGpu`, `computeSNPCoverage`
 * and `computeInterbaseCoverage` (which emits the last two) — so a display gets
 * these by running that pipeline, not by shaping them itself.
 *
 * Structural rather than nominal, and named after the layout rather than after
 * either display: the alignments worker's `CoverageUploadData` and the MAF
 * worker's `MafCoverageRegion` both satisfy it, which is what lets the passes
 * in `coverageBand.ts` carry their own packers instead of each plugin
 * restating four field reads.
 *
 * Its own module, apart from the GPU passes in `coverageBand.ts`: a state
 * model reaching for just this shape has no reason to statically pull in
 * every coverage shader — GPU pass descriptors are a display's *renderer*
 * concern, which is lazy-loaded, and a state model is not.
 */
export interface CoverageBandBuffers {
  coveragePackedBuffer: ArrayBuffer
  snpPackedBuffer: ArrayBuffer
  interbasePackedBuffer: ArrayBuffer
  indicatorPackedBuffer: ArrayBuffer
}

/**
 * Just the band's four buffers out of a wider per-region payload — the field set
 * stated once, so a display carrying them into its own upload payload cannot
 * spell three of them.
 */
export function coverageBandBuffers(
  src: CoverageBandBuffers,
): CoverageBandBuffers {
  return {
    coveragePackedBuffer: src.coveragePackedBuffer,
    snpPackedBuffer: src.snpPackedBuffer,
    interbasePackedBuffer: src.interbasePackedBuffer,
    indicatorPackedBuffer: src.indicatorPackedBuffer,
  }
}
