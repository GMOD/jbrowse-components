import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'

/**
 * The two payload fixtures every dotplot suite needs, shared so that a lane
 * added to either shape is added once.
 *
 * Nine files hand-rolled these before, each spelling out all fifteen fields of
 * the fetch payload to vary one of them, so every new lane — `alignmentLengths`,
 * the attribute channels, the refName dictionaries, `nameIds` — was a
 * nine-file mechanical edit that said nothing about any of the nine tests. The
 * overrides argument is how each suite keeps saying only what it varies.
 *
 * One feature, one segment, forward strand, and every optional channel present
 * but empty (-1, the worker's missing sentinel), so a suite that overrides
 * nothing gets the plainest possible payload rather than a special case.
 */
export function fakeDotplotRpcData(
  overrides: Partial<DotplotRpcData> = {},
): DotplotRpcData {
  return {
    p11: new Float64Array([0]),
    p12: new Float64Array([0]),
    p21: new Float64Array([0]),
    p22: new Float64Array([0]),
    strands: new Int8Array([1]),
    alignmentLengths: new Uint32Array([100]),
    attributes: {
      identity: new Float32Array([-1]),
      meanIdentity: new Float32Array([-1]),
      mappingQual: new Float32Array([-1]),
      dnds: new Float32Array([-1]),
    },
    attributeRanges: {},
    refNameDict: ['chr1'],
    refNameIds: new Uint32Array([0]),
    mateRefNameDict: ['chr2'],
    mateRefNameIds: new Uint32Array([0]),
    // A PAF names no feature, so one empty string is the realistic dictionary
    nameDict: [''],
    nameIds: new Uint32Array([0]),
    cigarData: new Uint32Array(0),
    cigarOffsets: new Uint32Array([0, 0]),
    totalFeatureCount: 1,
    skippedFeatureCount: 0,
    ...overrides,
  }
}

/**
 * Geometry for `n` segments, all zero, in the SoA shape `buildLineSegments`
 * emits. Callers fill the lanes they care about — a renderer suite wants
 * coordinates, the pick suite wants coordinates and `instanceFeatureIdx`,
 * nothing but the tooltip wants `segmentOps`.
 */
export function fakeDotplotInstanceData(
  n: number,
  overrides: Partial<DotplotInstanceData> = {},
): DotplotInstanceData {
  return {
    x1: new Float64Array(n),
    y1: new Float64Array(n),
    x2: new Float64Array(n),
    y2: new Float64Array(n),
    instanceFeatureIdx: new Uint32Array(n),
    segmentOps: new Uint8Array(n),
    instanceCount: n,
    baseH: 0,
    baseV: 0,
    ...overrides,
  }
}
