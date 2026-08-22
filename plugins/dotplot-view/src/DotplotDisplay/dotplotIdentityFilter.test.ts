import { buildLineSegments } from './dotplotGeometry.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

function makeRpcData(identities: number[]) {
  const n = identities.length
  return fakeDotplotRpcData({
    p11: new Float64Array(n).fill(0),
    p12: new Float64Array(n).fill(100),
    p21: new Float64Array(n).fill(0),
    p22: new Float64Array(n).fill(100),
    strands: new Int8Array(n).fill(1),
    alignmentLengths: new Uint32Array(n).fill(100),
    attributes: { identity: new Float32Array(identities) },
    refNameIds: new Uint32Array(n),
    mateRefNameIds: new Uint32Array(n),
    nameIds: new Uint32Array(n),
    cigarOffsets: new Uint32Array(n + 1),
    totalFeatureCount: n,
  })
}

function keptFeatures(identities: number[], minIdentity: number) {
  const segs = buildLineSegments(
    makeRpcData(identities),
    false,
    0,
    minIdentity,
    1,
    1,
    0,
    0,
  )
  return [...segs.instanceFeatureIdx.subarray(0, segs.instanceCount)]
}

describe('minIdentity filter', () => {
  test('drops features below the threshold, keeps those at or above it', () => {
    expect(keptFeatures([0.5, 0.9, 0.95], 0.9)).toStrictEqual([1, 2])
  })

  // The channel is Float32, so the stored 0.9 is 0.89999997615 and comparing it
  // against the Float64 threshold the slider holds drops the feature the slider
  // names. Every round percent the step lands on is one of these.
  test('keeps a feature sitting exactly on the threshold', () => {
    for (const pct of [0.25, 0.9, 0.95, 0.99]) {
      expect(keptFeatures([pct], pct)).toStrictEqual([0])
    }
  })

  test('a threshold of zero filters nothing', () => {
    expect(keptFeatures([0.5, 0.9, 0.95], 0)).toStrictEqual([0, 1, 2])
  })

  // -1 is the worker's missing sentinel, not an identity of -100%: a track
  // whose adapter reports no identity must not empty as the slider moves.
  test('keeps features carrying no identity at every threshold', () => {
    expect(keptFeatures([-1, -1], 0.99)).toStrictEqual([0, 1])
  })

  test('filters alongside minAlignmentLength rather than replacing it', () => {
    const data = fakeDotplotRpcData({
      p11: new Float64Array([0, 0]),
      p12: new Float64Array([100, 100]),
      p21: new Float64Array([0, 0]),
      p22: new Float64Array([100, 100]),
      strands: new Int8Array([1, 1]),
      alignmentLengths: new Uint32Array([50, 5_000]),
      attributes: { identity: new Float32Array([0.99, 0.5]) },
      refNameIds: new Uint32Array(2),
      mateRefNameIds: new Uint32Array(2),
      nameIds: new Uint32Array(2),
      cigarOffsets: new Uint32Array(3),
      totalFeatureCount: 2,
    })
    const segs = buildLineSegments(data, false, 1_000, 0.9, 1, 1, 0, 0)
    expect(segs.instanceCount).toBe(0)
  })
})
