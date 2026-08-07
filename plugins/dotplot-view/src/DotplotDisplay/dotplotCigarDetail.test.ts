import { MIN_CIGAR_PX_WIDTH, cigarWorthParsing } from './dotplotCigarDetail.ts'
import { buildLineSegments } from './dotplotGeometry.ts'

import type { DotplotRpcData } from './types.ts'

// packed as parseCigar2Typed emits: len << 4 | op
const M = (len: number) => (len << 4) | 0 // CIGAR_M
const D = (len: number) => (len << 4) | 2 // CIGAR_D

describe('cigarWorthParsing', () => {
  it('keeps an alignment already wide enough to walk', () => {
    expect(cigarWorthParsing(1000, 1000, 1, 1)).toBe(true)
  })

  it('drops an alignment far below the threshold at this zoom', () => {
    // 100bp at 10_000 bp/px = 0.01px on both axes
    expect(cigarWorthParsing(100, 100, 10_000, 10_000)).toBe(false)
  })

  it('keeps an alignment that is wide on only one axis', () => {
    // sub-pixel horizontally, but 100px tall — the geometry builder takes the
    // max of the two, so this one does get walked
    expect(cigarWorthParsing(1, 1000, 10_000, 10)).toBe(true)
  })

  it('keeps sub-threshold alignments within zoom headroom of being drawn', () => {
    // just under the draw threshold: no detail is walked yet, but a zoom-in
    // before the debounced refetch would need it
    const spanBp = MIN_CIGAR_PX_WIDTH * 0.5
    expect(cigarWorthParsing(spanBp, spanBp, 1, 1)).toBe(true)
  })
})

// The flat (cigarData, cigarOffsets) layout replaced an array-of-arrays, so the
// per-feature slicing is the thing worth pinning: an off-by-one in the offsets
// would silently walk a neighbour's ops.
describe('buildLineSegments over flat cigar buffers', () => {
  function makeData(): DotplotRpcData {
    // three features: the first and last carry CIGARs of different lengths, the
    // middle one carries none
    const first = [M(50), D(20), M(30)]
    const last = [M(60), M(40)]
    return {
      p11: new Float64Array([0, 10_000, 20_000]),
      p12: new Float64Array([100, 10_100, 20_100]),
      p21: new Float64Array([0, 10_000, 20_000]),
      p22: new Float64Array([100, 10_100, 20_100]),
      strands: new Int8Array([1, 1, 1]),
      alignmentLengths: new Uint32Array([100, 100, 100]),
      attributes: {
        identity: new Float32Array([-1, -1, -1]),
        meanIdentity: new Float32Array([-1, -1, -1]),
        mappingQual: new Float32Array([-1, -1, -1]),
        dnds: new Float32Array(0),
      },
      attributeRanges: {},
      refNameDict: ['chr1'],
      refNameIds: new Uint32Array([0, 0, 0]),
      mateRefNameDict: ['chr2'],
      mateRefNameIds: new Uint32Array([0, 0, 0]),
      cigarData: new Uint32Array([...first, ...last]),
      cigarOffsets: new Uint32Array([0, first.length, first.length, 5]),
      totalFeatureCount: 3,
      skippedFeatureCount: 0,
    }
  }

  it('walks each feature only over its own slice', () => {
    const segs = buildLineSegments(makeData(), true, 0, 1, 1, 0, 0)
    // 3 ops + 1 flat (no cigar) + 2 ops
    expect(segs.instanceCount).toBe(6)
    // feature 0's walk stays inside its own span
    expect(segs.x1[0]).toBe(0)
    expect(segs.x2[2]).toBeCloseTo(100)
    // the cigar-less middle feature is a single flat segment end to end
    expect(segs.x1[3]).toBe(10_000)
    expect(segs.x2[3]).toBe(10_100)
    // feature 2 resumes at its own start, not wherever feature 0 left off
    expect(segs.x1[4]).toBe(20_000)
    expect(segs.x2[5]).toBeCloseTo(20_100)
  })

  it('emits one flat segment per feature when drawCigar is off', () => {
    const segs = buildLineSegments(makeData(), false, 0, 1, 1, 0, 0)
    expect(segs.instanceCount).toBe(3)
  })
})
