import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'
import { KIND_BASE, KIND_CIGAR_D, KIND_MARKER } from './syntenyColors.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// A coarse-tier row carries no CIGAR but may carry `coarseCigar`, make-pif's
// fold of it: the runs between the indels it kept, each advancing the two axes
// by its own length, and those indels. The worker walks that in the CIGAR's
// place, so the kept gap draws as the same colored wedge the fine tier draws
// for it, and a row without the tag draws as a plain ribbon.

const QUERY_ASM = 'query'
const TARGET_ASM = 'target'

function region(assemblyName: string, refName: string, end: number): Region {
  return { assemblyName, refName, start: 0, end }
}

// 100 bp/px, so the 52kb block is 520px wide and its 50kb gap 500px: both well
// past the width gates
const queryView = {
  bpPerPx: 100,
  offsetPx: 0,
  width: 800,
  displayedRegions: [region(QUERY_ASM, 'q1', 100000)],
  fetchRegions: [region(QUERY_ASM, 'q1', 100000)],
}

const targetView = {
  bpPerPx: 100,
  offsetPx: 0,
  displayedRegions: [region(TARGET_ASM, 't1', 100000)],
}

function coarseRow(id: string, coarseCigar?: string): Feature {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'q1',
    start: 0,
    end: 52000,
    strand: 1,
    coarseCigar,
    mate: {
      refName: 't1',
      start: 0,
      end: 2000,
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
    adapterConfig: { type: 'PairwiseIndexedPAFAdapter' },
    queryView,
    targetView,
  })
  return value
}

// the ribbon kinds drawn for one feature, location markers aside. Features
// come back in draw order, so they are looked up by id rather than by the order
// they went in.
function kindsOf(value: Awaited<ReturnType<typeof run>>, id: string) {
  const featureIdx = value.featureIds.indexOf(id)
  const { kinds, instanceFeatureIdx, instanceCount } = value.instanceData
  const out: number[] = []
  for (let i = 0; i < instanceCount; i++) {
    if (instanceFeatureIdx[i] === featureIdx && kinds[i] !== KIND_MARKER) {
      out.push(kinds[i]!)
    }
  }
  return out
}

test('a coarse row with a kept gap draws the gap as a colored wedge', async () => {
  const value = await run([
    coarseRow('with-tag', '1000:1000M50000D1000M'),
    coarseRow('plain'),
  ])
  expect([...value.featureIds].sort()).toEqual(['plain', 'with-tag'])
  expect(kindsOf(value, 'with-tag')).toContain(KIND_CIGAR_D)
  expect(kindsOf(value, 'plain')).toEqual([KIND_BASE])
})

test('the coarse fold counts as an alignment string for the walks', async () => {
  const value = await run([coarseRow('with-tag', '1000M50000D1000M')])
  expect(value.hasCigar).toBe(true)
})

test('a coarse row without the fold leaves nothing to walk', async () => {
  const value = await run([coarseRow('plain')])
  expect(value.hasCigar).toBe(false)
})
