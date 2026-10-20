import { abgrAlpha } from '@jbrowse/core/util/colorBits'

import { computeDotplotColors } from './dotplotColors.ts'
import { buildLineSegments } from './dotplotGeometry.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

function makeRpcData(identities: number[], lengths?: number[]) {
  const n = identities.length
  return fakeDotplotRpcData({
    p11: new Float64Array(n).fill(0),
    p12: new Float64Array(n).fill(100),
    p21: new Float64Array(n).fill(0),
    p22: new Float64Array(n).fill(100),
    strands: new Int8Array(n).fill(1),
    alignmentLengths: lengths
      ? Uint32Array.from(lengths)
      : new Uint32Array(n).fill(100),
    attributes: { identity: new Float32Array(identities) },
    refNameIds: new Uint32Array(n),
    mateRefNameIds: new Uint32Array(n),
    nameIds: new Uint32Array(n),
    cigarOffsets: new Uint32Array(n + 1),
    totalFeatureCount: n,
  })
}

// The features whose segments draw: the geometry keeps every feature past the
// length cut, and the color pass paints a segment of one the filter rejects
// at zero alpha, which the draw and the pick both skip.
function drawnFeatures(
  identities: number[],
  predicates: FieldPredicate[],
  { lengths, minLength = 0 }: { lengths?: number[]; minLength?: number } = {},
) {
  const rpcData = makeRpcData(identities, lengths)
  const instanceData = buildLineSegments(rpcData, false, minLength, 1, 1, 0, 0)
  const colors = computeDotplotColors({
    instanceData,
    rpcData,
    field: '',
    trackColor: '#000',
    attributeRanges: {},
    filter: {
      predicates,
      extras: { lengthOf: i => rpcData.alignmentLengths[i]! },
    },
  })
  return [
    ...instanceData.instanceFeatureIdx.subarray(0, instanceData.instanceCount),
  ].filter((_, s) => abgrAlpha(colors[s]!) > 0)
}

describe('an identity filter on the dotplot', () => {
  test('drops features below the bound, keeps those at or above it', () => {
    expect(
      drawnFeatures([0.5, 0.9, 0.95], [{ field: 'identity', gte: 0.9 }]),
    ).toStrictEqual([1, 2])
  })

  // The channel is Float32, so the stored 0.9 is 0.89999997615; the compiler
  // rounds the bound to the lane's precision, or a slider at 90% would drop the
  // 90% alignment it names.
  test('keeps a feature sitting exactly on the bound', () => {
    for (const pct of [0.25, 0.9, 0.95, 0.99]) {
      expect(
        drawnFeatures([pct], [{ field: 'identity', gte: pct }]),
      ).toStrictEqual([0])
    }
  })

  test('an alignment reporting no identity fails the comparison', () => {
    expect(
      drawnFeatures([Number.NaN, 0.95], [{ field: 'identity', gte: 0.5 }]),
    ).toStrictEqual([1])
  })

  test('applies alongside the length cut', () => {
    expect(
      drawnFeatures([0.99, 0.5], [{ field: 'identity', gte: 0.9 }], {
        lengths: [50, 5000],
        minLength: 1000,
      }),
    ).toStrictEqual([])
  })

  test('a length predicate with no lower bound filters in the color pass', () => {
    expect(
      drawnFeatures([0.9, 0.9], [{ field: 'length', lte: 1000 }], {
        lengths: [500, 5000],
      }),
    ).toStrictEqual([0])
  })
})
