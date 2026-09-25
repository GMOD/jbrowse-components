import { RowKeys } from '@jbrowse/render-core/marks'

import { buildMultiRowChannels } from './multiRowChannels.ts'

import type { MultiRowEncoded } from './multiRowChannels.ts'
import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

interface DecodedInstance {
  startBp: number
  endBp: number
  key: number
  color: number
}

function decode(c: SpanChannels): DecodedInstance[] {
  const out: DecodedInstance[] = []
  for (let i = 0; i < c.count; i++) {
    out.push({
      startBp: c.x[i]!,
      endBp: c.x2[i]!,
      key: c.row[i]!,
      color: c.color[i]!,
    })
  }
  return out
}

const region: MultiRowRegionData = {
  featureStarts: Uint32Array.from([10, 20, 30]),
  featureEnds: Uint32Array.from([15, 25, 35]),
  featureColors: Uint32Array.from([0xff0000ff, 0xff00ff00, 0xffff0000]),
  partitionValues: ['momHP0', 'dadHP1'],
  featurePartitionIndex: Uint32Array.from([0, 1, 0]),
  featureNames: ['a', 'b', 'c'],
  featureIds: ['f1', 'f2', 'f3'],
  featureDeltas: new Int32Array(0),
  usedItemRgb: false,
  partitionCandidates: [],
  partitionCandidateValues: [],
  legendCandidates: [],
  resolvedPartitionField: 'name',
}

function inputs(
  keyed: string[],
  opts?: { overriddenRows?: Set<string>; hiddenColors?: Set<number> },
) {
  const rowKeys = new RowKeys()
  for (const name of keyed) {
    rowKeys.keyOf(name)
  }
  return {
    rowKeys,
    overriddenRows: opts?.overriddenRows ?? new Set<string>(),
    hiddenColors: opts?.hiddenColors ?? new Set<number>(),
  }
}

test('each feature carries its row key and its baked colour', () => {
  const buffer = buildMultiRowChannels(region, inputs(['dadHP1', 'momHP0']))
  expect(decode(buffer)).toEqual([
    { startBp: 10, endBp: 15, key: 1, color: 0xff0000ff },
    { startBp: 20, endBp: 25, key: 0, color: 0xff00ff00 },
    { startBp: 30, endBp: 35, key: 1, color: 0xffff0000 },
  ])
})

test('a value with no key yet is given the next one', () => {
  const in_ = inputs(['dadHP1'])
  const buffer = buildMultiRowChannels(region, in_)
  expect(decode(buffer).map(d => d.key)).toEqual([1, 0, 1])
  expect(in_.rowKeys.names).toEqual(['dadHP1', 'momHP0'])
})

test('skips features whose color is a hidden category', () => {
  const buffer = buildMultiRowChannels(
    region,
    inputs(['momHP0', 'dadHP1'], { hiddenColors: new Set([0xff00ff00]) }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 30])
})

test('a hidden category does not drop features on rows with a color override', () => {
  const buffer = buildMultiRowChannels(
    region,
    inputs(['momHP0', 'dadHP1'], {
      overriddenRows: new Set(['momHP0']),
      hiddenColors: new Set([0xff0000ff]),
    }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 20, 30])
})

// The per-key buckets, built from the same walk as the channels: a hit on the
// wrong feature is what getting the index arithmetic wrong looks like, and the
// buckets hold CHANNEL indices, since the encode compacts what it skips.
function bucketsOf({ rowStart, rowIndices }: MultiRowEncoded) {
  return [...rowStart.slice(0, -1)].map((lo, r) => [
    ...rowIndices.subarray(lo, rowStart[r + 1]),
  ])
}

test('buckets each channel under its key, in paint order', () => {
  const encoded = buildMultiRowChannels(
    region,
    inputs(['dadHP1', 'other', 'momHP0']),
  )
  expect(bucketsOf(encoded)).toEqual([[1], [], [0, 2]])
  expect([...encoded.featureIndex.subarray(0, encoded.count)]).toEqual([
    0, 1, 2,
  ])
})

test('a skipped feature leaves no bucket entry and the channel indices stay compact', () => {
  const encoded = buildMultiRowChannels(
    region,
    inputs(['momHP0', 'dadHP1'], { hiddenColors: new Set([0xff00ff00]) }),
  )
  expect(encoded.count).toBe(2)
  // the buckets run to the last key that drew anything
  expect(bucketsOf(encoded)).toEqual([[0, 1]])
  expect([...encoded.featureIndex.subarray(0, encoded.count)]).toEqual([0, 2])
})

test('a region with nothing drawn has no buckets', () => {
  const encoded = buildMultiRowChannels(
    region,
    inputs([], { hiddenColors: new Set([0xff0000ff, 0xff00ff00, 0xffff0000]) }),
  )
  expect(encoded.count).toBe(0)
  expect(bucketsOf(encoded)).toEqual([])
})
