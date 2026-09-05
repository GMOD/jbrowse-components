import { buildMultiRowChannels } from './multiRowChannels.ts'

import type { MultiRowEncoded } from './multiRowChannels.ts'
import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'
import type { SpanChannels } from '@jbrowse/render-core/marks'

interface DecodedInstance {
  startBp: number
  endBp: number
  rowIndex: number
  color: number
}

function decode(c: SpanChannels): DecodedInstance[] {
  const out: DecodedInstance[] = []
  for (let i = 0; i < c.count; i++) {
    out.push({
      startBp: c.x[i]!,
      endBp: c.x2[i]!,
      rowIndex: c.row[i]!,
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

function paintState(
  rowIndexByValue: Map<string, number>,
  opts?: {
    rowColorsByIndex?: (number | undefined)[]
    hiddenColors?: Set<number>
  },
) {
  return {
    rowIndexByValue,
    rowColorsByIndex: opts?.rowColorsByIndex ?? [],
    hiddenColors: opts?.hiddenColors ?? new Set<number>(),
  }
}

test('maps partition values to global row indices', () => {
  const rowIndexByValue = new Map([
    ['dadHP1', 0],
    ['momHP0', 1],
  ])
  const buffer = buildMultiRowChannels(region, paintState(rowIndexByValue))
  expect(decode(buffer)).toEqual([
    { startBp: 10, endBp: 15, rowIndex: 1, color: 0xff0000ff },
    { startBp: 20, endBp: 25, rowIndex: 0, color: 0xff00ff00 },
    { startBp: 30, endBp: 35, rowIndex: 1, color: 0xffff0000 },
  ])
})

test('skips features whose partition value has no assigned row', () => {
  const rowIndexByValue = new Map([['momHP0', 0]])
  const buffer = buildMultiRowChannels(region, paintState(rowIndexByValue))
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 30])
})

test('skips features whose color is a hidden category', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  const buffer = buildMultiRowChannels(
    region,
    paintState(rowIndexByValue, { hiddenColors: new Set([0xff00ff00]) }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 30])
})

test('a hidden category does not drop features on rows with a color override', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  const buffer = buildMultiRowChannels(
    region,
    paintState(rowIndexByValue, {
      rowColorsByIndex: [0xff123456, undefined],
      hiddenColors: new Set([0xff0000ff]),
    }),
  )
  expect(decode(buffer).map(d => d.startBp)).toEqual([10, 20, 30])
})

test('rowColorsByIndex overrides the baked color for that row only', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  const buffer = buildMultiRowChannels(
    region,
    paintState(rowIndexByValue, { rowColorsByIndex: [0xff123456, undefined] }),
  )
  expect(decode(buffer).map(d => d.color)).toEqual([
    0xff123456, 0xff00ff00, 0xff123456,
  ])
})

// The per-row buckets, built from the same walk as the channels: a hit on the
// wrong feature is what getting the index arithmetic wrong looks like, and the
// buckets hold CHANNEL indices, since the encode compacts what it skips.
function bucketsOf({ rowStart, rowIndices }: MultiRowEncoded) {
  return [...rowStart.slice(0, -1)].map((lo, r) => [
    ...rowIndices.subarray(lo, rowStart[r + 1]),
  ])
}

test('buckets each channel onto its display row, in paint order', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 2],
    ['dadHP1', 0],
  ])
  const encoded = buildMultiRowChannels(region, paintState(rowIndexByValue))
  expect(bucketsOf(encoded)).toEqual([[1], [], [0, 2]])
  expect([...encoded.featureIndex.subarray(0, encoded.count)]).toEqual([
    0, 1, 2,
  ])
})

test('a skipped feature leaves no bucket entry and the channel indices stay compact', () => {
  const rowIndexByValue = new Map([
    ['momHP0', 0],
    ['dadHP1', 1],
  ])
  const encoded = buildMultiRowChannels(
    region,
    paintState(rowIndexByValue, { hiddenColors: new Set([0xff00ff00]) }),
  )
  expect(encoded.count).toBe(2)
  // the buckets run to the last row that drew anything
  expect(bucketsOf(encoded)).toEqual([[0, 1]])
  expect([...encoded.featureIndex.subarray(0, encoded.count)]).toEqual([0, 2])
})

test('a region with nothing drawn has no buckets', () => {
  const encoded = buildMultiRowChannels(region, paintState(new Map()))
  expect(encoded.count).toBe(0)
  expect(bucketsOf(encoded)).toEqual([])
})
