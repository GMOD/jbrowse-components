import { namesToBlock } from '@jbrowse/alignments-core'

import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
} from './testUtils.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

function readsWithMapq(mapq: number, n = 3): WorkerPileupData {
  const readPositions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    readPositions[i * 2] = 1000
    readPositions[i * 2 + 1] = 1100
  }
  return {
    ...makeEmptyPileupData(),
    readKeys: Array.from({ length: n }, (_, i) => `m${mapq}r${i}`),
    ...namesToBlock(Array.from({ length: n }, (_, i) => `m${mapq}read${i}`)),
    readPositions,
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n).fill(mapq),
    readStrands: new Int8Array(n).fill(1),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
    segmentPositions: readPositions,
    segmentReadIndices: Uint32Array.from({ length: n }, (_, i) => i),
    segmentEdgeFlags: new Uint8Array(n).fill(3),
    numSegments: n,
  }
}

function twoLaneDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  view.setNewView(10, 0)
  display.facetByField('strand')
  display.applyPlot({ encoding: { color: { field: 'mapq' } } })
  display.setShowLegend(true)
  display.setRpcData(
    0,
    {
      groups: [
        { key: 'high', label: 'high', data: readsWithMapq(60) },
        { key: 'low', label: 'low', data: readsWithMapq(0) },
      ],
    },
    { refName: 'ctgA', start: 0, end: 10_000, assemblyName: 'volvox' },
  )
  return display
}

test('the key lists the read colors of every lane drawing rows', () => {
  const display = twoLaneDisplay()
  expect(display.presentTagValues?.size).toBe(2)
  expect(display.colorLegendCategories.size).toBeGreaterThan(0)
})

test('with the pileup hidden the key lists no read color', () => {
  const display = twoLaneDisplay()
  display.setShowPileup(false)
  expect(display.presentTagValues?.size).toBe(0)
  expect(display.colorLegendCategories.size).toBe(0)
})

test('a lane collapsed to its coverage keys none of its read colors', () => {
  const display = twoLaneDisplay()
  display.toggleGroupCollapsed('low')
  expect([...(display.presentTagValues ?? [])]).toEqual(['60'])
})
