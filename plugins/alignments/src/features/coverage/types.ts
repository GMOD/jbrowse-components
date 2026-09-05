export interface CoverageHitResult {
  type: 'coverage'
  position: number
}

/**
 * What the Canvas2D depth-bar draw takes off a region. The buffer is the GPU
 * pass's own — one worker-packed layout for both backends — so `coverageMaxDepth`
 * travels with it to un-bake the `relDepth` it holds, and `coverageBinSize` is
 * how wide each of its records is in bp.
 *
 * `coverageMaxDepth` is also read where the buffer is empty (the y-axis legend),
 * which is why it is a field rather than something the draw derives.
 */
export interface CoverageRegionFields {
  coveragePackedBuffer: ArrayBuffer
  coverageMaxDepth: number
  coverageBinSize: number
}
