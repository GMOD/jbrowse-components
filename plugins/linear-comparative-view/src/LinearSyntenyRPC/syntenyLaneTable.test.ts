import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { SYNTENY_LANES, syntenyLaneFields } from '@jbrowse/synteny-core'

import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { executeSyntenyFeaturesAndPositions } from './executeSyntenyFeaturesAndPositions.ts'

import type { SyntenyRpcResult } from './executeSyntenyFeaturesAndPositions.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// Pins the worker's hand-written pack loop to the lane table: every lane
// `SYNTENY_LANES` names must come out of the REAL
// `executeSyntenyFeaturesAndPositions` with the right element type and length,
// honoring its sentinel, and the payload may carry nothing the table does not
// name. A lane dropped from the loop — or added to it without a table entry —
// fails here by name.

function region(assemblyName: string, refName: string): Region {
  return { assemblyName, refName, start: 0, end: 10000 }
}

const features = [
  new SimpleFeature({
    uniqueId: 'named',
    refName: 'q1',
    start: 100,
    end: 200,
    strand: -1,
    name: 'genA',
    assemblyName: 'queryAsm',
    mate: { refName: 't1', start: 300, end: 400, assemblyName: 'targetAsm' },
  }),
  // no name, no assemblyName: the record the sentinel checks read
  new SimpleFeature({
    uniqueId: 'anon',
    refName: 'q1',
    start: 500,
    end: 600,
    strand: 1,
    mate: { refName: 't1', start: 700, end: 800, assemblyName: 'targetAsm' },
  }),
]

let data: SyntenyRpcResult
beforeAll(async () => {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeaturesInMultipleRegionsArray: async () => features,
  } as never)
  const { value } = await executeSyntenyFeaturesAndPositions({
    pluginManager: {} as PluginManager,
    sessionId: 't1',
    adapterConfig: { type: 'PAFAdapter' },
    queryView: {
      bpPerPx: 1,
      offsetPx: 0,
      width: 800,
      displayedRegions: [region('query', 'q1')],
      fetchRegions: [region('query', 'q1')],
    },
    targetView: {
      bpPerPx: 1,
      offsetPx: 0,
      displayedRegions: [region('target', 't1')],
    },
  })
  data = value
})

const raw = () => data as unknown as Record<string, unknown>
const count = () => data.featureIds.length

describe('the pack loop writes every lane the table names', () => {
  for (const lane of SYNTENY_LANES) {
    switch (lane.kind) {
      case 'i8':
      case 'u32':
        it(`packs ${lane.name}`, () => {
          const arr = raw()[lane.name]
          expect(arr).toBeInstanceOf(
            lane.kind === 'i8' ? Int8Array : Uint32Array,
          )
          expect((arr as Uint32Array).length).toBe(count())
        })
        break
      case 'string[]':
        it(`packs ${lane.name}`, () => {
          const arr = raw()[lane.name]
          expect(Array.isArray(arr)).toBe(true)
          expect((arr as string[]).every(v => typeof v === 'string')).toBe(true)
        })
        break
      case 'string-dict':
        it(`packs ${lane.name}Dict/${lane.name}Ids`, () => {
          const dict = raw()[`${lane.name}Dict`] as string[]
          const ids = raw()[`${lane.name}Ids`] as Uint32Array
          expect(Array.isArray(dict)).toBe(true)
          expect(dict.every(v => typeof v === 'string')).toBe(true)
          expect(ids).toBeInstanceOf(Uint32Array)
          expect(ids.length).toBe(count())
          expect([...ids].every(id => id < dict.length)).toBe(true)
        })
        if (lane.sentinel !== undefined) {
          it(`packs ${lane.name}'s sentinel for a record without one`, () => {
            const dict = raw()[`${lane.name}Dict`] as string[]
            const ids = raw()[`${lane.name}Ids`] as Uint32Array
            const i = data.featureIds.indexOf('anon')
            expect(dict[ids[i]!]).toBe(lane.sentinel)
          })
        }
        break
      case 'opaque':
        it(`carries ${lane.name}`, () => {
          expect(raw()[lane.name]).toBeDefined()
        })
        break
    }
  }
})

it('the payload carries exactly the fields the table names', () => {
  const { instanceData, ...featureData } = data
  expect(Object.keys(featureData).sort()).toEqual(
    SYNTENY_LANES.flatMap(syntenyLaneFields).sort(),
  )
})

it('getFeatureAtIndex reads a packed record back whole', () => {
  const i = data.featureIds.indexOf('named')
  expect(getFeatureAtIndex(data, i)).toEqual({
    id: 'named',
    strand: -1,
    name: 'genA',
    refName: 'q1',
    start: 100,
    end: 200,
    assemblyName: 'queryAsm',
    mate: { start: 300, end: 400, refName: 't1', assemblyName: 'targetAsm' },
    attributes: {},
  })
})
