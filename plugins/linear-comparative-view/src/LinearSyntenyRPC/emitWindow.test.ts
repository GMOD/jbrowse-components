import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import {
  fetchWindowSignature,
  syntenyFetchRegions,
} from '@jbrowse/synteny-core'

import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'
import { KIND_BASE, KIND_CIGAR_D } from './syntenyColors.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// The fetch key is the snapped fetch window's signature, and on a displayed
// region a few buffers wide the clamp pins that window to the region while the
// viewport keeps panning: 1400px at 100bp/px over a 500kb region, and every
// viewport start from 61kb to the region end shares one key. The worker has to
// emit geometry for the whole window, then, because nothing refetches before
// the viewport reaches its far end. Three things went missing at the trailing
// strip when the emit window was the viewport plus one buffer instead: a
// feature there on both axes (whole-feature cull), the CIGAR detail on a ribbon
// there (emit cull), and the far end of an oversized block re-anchored to the
// window (`clipLargeBlockToWindow`).

const QUERY_ASM = 'query'
const TARGET_ASM = 'target'
const WIDTH = 1400
const BP_PER_PX = 100
const REGION_START = 1_000_000
const REGION_END = 1_500_000
const region = (assemblyName: string, refName: string): Region => ({
  assemblyName,
  refName,
  start: REGION_START,
  end: REGION_END,
})
const queryRegions = [region(QUERY_ASM, 'q1')]
const targetRegions = [region(TARGET_ASM, 't1')]

const alignment = (id: string, start: number, end: number, cigar: string) =>
  new SimpleFeature({
    uniqueId: id,
    refName: 'q1',
    start,
    end,
    strand: 1,
    assemblyName: QUERY_ASM,
    CIGAR: cigar,
    mate: { refName: 't1', start, end, assemblyName: TARGET_ASM },
  })

// One ribbon in the last 40kb of the region, with a 5kb deletion (50px) in it,
// and a whole-chromosome chain that runs far past the region on both sides.
const FEATURES = [
  alignment('strip', 1_460_000, 1_480_000, '10000M5000D5000M'),
  alignment('chain', 0, 5_000_000, '5000000M'),
]

function windowAt(startBp: number, displayedRegions = queryRegions) {
  return syntenyFetchRegions({
    visibleRegions: [
      {
        ...displayedRegions[0]!,
        start: startBp,
        end: startBp + WIDTH * BP_PER_PX,
        displayedRegionIndex: 0,
      },
    ],
    displayedRegions,
    width: WIDTH,
    bpPerPx: BP_PER_PX,
  })
}

async function fetchAt(startBp: number) {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: async () => FEATURES,
  } as never)
  const offsetPx = (startBp - REGION_START) / BP_PER_PX
  return unwrapRpcResult(
    await executeSyntenyFeaturesAndPositions({
      pluginManager: {} as PluginManager,
      sessionId: 'emit',
      adapterConfig: { type: 'PAFAdapter' },
      queryView: {
        bpPerPx: BP_PER_PX,
        offsetPx,
        width: WIDTH,
        displayedRegions: queryRegions,
        fetchRegions: windowAt(startBp),
      },
      targetView: {
        bpPerPx: BP_PER_PX,
        offsetPx,
        displayedRegions: targetRegions,
        windowRegions: windowAt(startBp, targetRegions),
      },
    }),
  )
}

test('one key covers the pan from 110kb in to the region end', () => {
  const key = fetchWindowSignature(windowAt(REGION_START + 110_000))
  for (let start = REGION_START + 110_000; start <= 1_360_000; start += 7000) {
    expect(fetchWindowSignature(windowAt(start))).toBe(key)
  }
})

test('a fetch at 110kb emits the trailing strip that pan reaches', async () => {
  const { featureIds, instanceData } = await fetchAt(REGION_START + 110_000)
  const { kinds, bp1, bp2, base0, instanceFeatureIdx, instanceCount } =
    instanceData
  const strip = featureIds.indexOf('strip')
  const chain = featureIds.indexOf('chain')
  expect(strip).toBeGreaterThanOrEqual(0)
  expect(chain).toBeGreaterThanOrEqual(0)

  const of = (feature: number, kind: number) =>
    Array.from({ length: instanceCount }, (_, i) => i).filter(
      i => instanceFeatureIdx[i] === feature && kinds[i] === kind,
    )
  // the chain's base ribbon runs to the region end, in the region's cumBp
  const [chainBase] = of(chain, KIND_BASE)
  expect(chainBase).toBeDefined()
  expect(Math.max(bp1[chainBase!]!, bp2[chainBase!]!) + base0).toBeCloseTo(
    REGION_END - REGION_START,
    0,
  )
  expect(of(strip, KIND_CIGAR_D)).toHaveLength(1)
})
