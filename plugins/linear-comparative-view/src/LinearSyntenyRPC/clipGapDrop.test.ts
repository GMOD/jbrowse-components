import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// A chain converted to PAF is ONE record carrying the chain's gaps as CIGAR ops,
// and the top-level chain over a whole chromosome carries enormous ones — chimp
// chr19 -> hg38 chr17 is a single 86Mb record with a 30,846,489bp `D` where the
// pericentric inversion is, and the inverted segment is a separate record that
// covers it. `clipLargeBlockToWindow` re-anchors such a block to the visible
// window; a window inside the gap keeps only query-consuming ops, so the block
// comes back spanning the window against a mate span of ZERO.
//
// That is `clipSyntenyFeature` saying, correctly, that nothing here aligns.
// Kept, the single point it is anchored at gets read as a POSITION: a ribbon
// collapsing to a vertex tens of Mb from the alignments around it, culled by the
// band, and then marked by `culledRibbonMates` as an off-screen mate — which
// tells the reader to scroll to a mate that does not exist.

const QUERY_ASM = 'query'
const TARGET_ASM = 'target'

function region(assemblyName: string, refName: string, end: number): Region {
  return { assemblyName, refName, start: 0, end }
}

// bpPerPx 1 and offsetPx 20000, so the window `clipLargeBlockToWindow` re-anchors
// to is [18000, 22800]: the viewport plus `syntenyPanBufferPx`, which floors at
// 2000px on a view this narrow.
const queryView = {
  bpPerPx: 1,
  offsetPx: 20000,
  width: 800,
  displayedRegions: [region(QUERY_ASM, 'q1', 100000)],
  fetchRegions: [region(QUERY_ASM, 'q1', 100000)],
}

const targetView = {
  bpPerPx: 1,
  offsetPx: 0,
  displayedRegions: [region(TARGET_ASM, 't1', 100000)],
}

function alignment({
  id,
  start,
  end,
  mateStart,
  mateEnd,
  cigar,
}: {
  id: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  cigar: string
}): Feature {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'q1',
    start,
    end,
    strand: 1,
    CIGAR: cigar,
    mate: {
      refName: 't1',
      start: mateStart,
      end: mateEnd,
      assemblyName: TARGET_ASM,
    },
  })
}

async function run(features: Feature[]) {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: jest.fn(async () => features),
  } as never)
  const { value } = await executeSyntenyFeaturesAndPositions({
    pluginManager: {} as PluginManager,
    sessionId: 't1',
    adapterConfig: { type: 'PAFAdapter' },
    queryView,
    targetView,
  })
  return value
}

// 1000M then a 50,000bp deletion then 1000M: 52,000bp of query against 2,000bp
// of target, which clears CLIP_SPAN_RATIO x the 4,800bp window many times over.
// The window [18000, 22800] lands wholly inside the deletion.
const GAP_BLOCK = {
  id: 'chain-gap',
  start: 0,
  end: 52000,
  mateStart: 0,
  mateEnd: 2000,
  cigar: '1000M50000D1000M',
}

// The same block seen from a viewport over its LEADING match, where the clip
// keeps real alignment: the drop must be about the gap, not about the size.
const overLeadingMatch = { ...queryView, offsetPx: 0 }

test('a clip that lands wholly inside a chain gap drops the block', async () => {
  const value = await run([alignment(GAP_BLOCK)])

  expect(value.featureIds).toEqual([])
})

test('a block that still aligns in the window is kept', async () => {
  const value = await run([
    alignment(GAP_BLOCK),
    alignment({
      id: 'ordinary',
      start: 20000,
      end: 20500,
      mateStart: 20000,
      mateEnd: 20500,
      cigar: '500M',
    }),
  ])

  expect(value.featureIds).toEqual(['ordinary'])
})

test('the same oversized block is kept where the clip finds alignment', async () => {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: jest.fn(async () => [
      alignment(GAP_BLOCK),
    ]),
  } as never)
  const { value } = await executeSyntenyFeaturesAndPositions({
    pluginManager: {} as PluginManager,
    sessionId: 't1',
    adapterConfig: { type: 'PAFAdapter' },
    queryView: overLeadingMatch,
    targetView,
  })

  expect(value.featureIds).toEqual(['chain-gap'])
  expect(value.mateStarts[0]).toBe(0)
  expect(value.mateEnds[0]).toBe(2000)
})
