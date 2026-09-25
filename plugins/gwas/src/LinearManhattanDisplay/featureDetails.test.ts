import { getSession } from '@jbrowse/core/util'
import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
} from '@jbrowse/render-core/shaders/pointMarkConsts'
import { waitFor } from '@testing-library/react'

import {
  SLE_ADAPTER,
  SLE_INDEX_START,
  SLE_REGION,
  slePluginManager,
} from '../GWASAdapter/sle.fixture.ts'
import { LD_DOMAIN, LD_PALETTE } from './ldBins.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { manhattanLayer } from './manhattanLayer.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRequest } from './manhattanLayer.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { EncodedLayersResult } from '@jbrowse/core/util/markEncoding'

// The worker half, run as the worker runs it: the core methods out of the
// plugin manager's registry, over the SLE summary statistics and their `.ld`.
describe('a point reads back as its whole GWAS record', () => {
  const pluginManager = slePluginManager()
  const invoke = (method: string, args: object) =>
    pluginManager.getRpcMethodType(method).invoke({ sessionId: 's', ...args })
  const request: ManhattanRequest = {
    adapterConfig: SLE_ADAPTER,
    region: SLE_REGION,
    layers: [
      manhattanLayer({
        scoreField: 'score',
        color: {
          field: 'ld',
          scale: 'threshold',
          domain: LD_DOMAIN,
          range: LD_PALETTE,
        },
        ldColoring: true,
      }),
    ],
    opts: { ld: { index: { start: SLE_INDEX_START }, refName: '2' } },
  }

  async function drawnAt(start: number) {
    const encoded = (await invoke('CoreGetEncodedLayers', request)) as {
      value: EncodedLayersResult
    }
    const layer = encoded.value.layers[0]!
    const i = layer.x.indexOf(start)
    const feature = (await invoke('CoreGetEncodedFeature', {
      ...request,
      layer: 0,
      featureIndex: layer.featureIndex[i]!,
    })) as SimpleFeatureSerialized
    return { glyph: layer.glyph![i], feature }
  }

  it("carries the file's own columns and the r² to the index", async () => {
    const { glyph, feature } = await drawnAt(191_794_579)
    expect(glyph).toBe(GLYPH_DISC)
    expect(feature).toMatchObject({
      name: 'rs193239665',
      ref: 'A',
      alt: 'T',
      beta: '0.3293',
      ld_role: 'partner',
    })
    expect(feature.ld).toBeCloseTo(0.037)
  })

  it('draws the index SNP as the diamond, at r² 1', async () => {
    const { glyph, feature } = await drawnAt(SLE_INDEX_START)
    expect(glyph).toBe(GLYPH_DIAMOND)
    expect(feature).toMatchObject({ name: 'rs4274624', ld: 1 })
  })
})

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function callsOf(mock: jest.Mock, method: string) {
  return mock.mock.calls.filter(call => call[1] === method)
}

function answerFetches(mock: jest.Mock, readBack?: object) {
  mock.mockImplementation((_sessionId: string, method: string) =>
    method === 'CoreGetEncodedLayers'
      ? Promise.resolve({
          layers: [manhattanFixture({ x: [100, 200], y: [3, 8] })],
        })
      : method === 'CoreGetEncodedFeature'
        ? Promise.resolve(readBack)
        : new Promise(() => {}),
  )
}

test('a click asks the worker for the feature under the request its region came back by', async () => {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  const record = {
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 200,
    end: 201,
    name: 'rs1',
    beta: '0.1',
  }
  answerFetches(mockRpcCall, record)
  const { display, session } = createDisplay()
  await waitFor(() => {
    expect(display.rpcDataMap.get(0)?.request).toBeDefined()
  })
  const [, , fetched] = callsOf(mockRpcCall, 'CoreGetEncodedLayers').find(
    ([, , args]) => args.region.refName === 'ctgA',
  )!
  display.selectFeature({
    refName: 'ctgA',
    start: 200,
    end: 201,
    score: 8,
    regionIndex: 0,
    instance: 1,
  })
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  expect(session.openedWidgets[0]!.featureData).toEqual(record)
  const [, , asked] = callsOf(mockRpcCall, 'CoreGetEncodedFeature')[0]!
  const { region, layers, adapterConfig } = fetched
  expect(asked).toMatchObject({
    region,
    layers,
    adapterConfig,
    layer: 0,
    featureIndex: 1,
  })
  expect(asked).not.toHaveProperty('byteLimit')
})

test('a region no worker fetch produced holds no request, and a click on it asks nothing', () => {
  const { display, mockRpcCall } = createTestEnvironment().createDisplay()
  display.setRpcData(0, manhattanFixture({ x: [100], y: [3] }), REGION)
  mockRpcCall.mockClear()
  display.selectFeature({
    refName: 'ctgA',
    start: 100,
    end: 101,
    score: 3,
    regionIndex: 0,
    instance: 0,
  })
  expect(callsOf(mockRpcCall, 'CoreGetEncodedFeature')).toHaveLength(0)
})

// The LD file may spell a contig otherwise than the view and the GWAS file,
// and the worker has no aliases to find out, so each region's fetch carries
// the LD file's name for its contig, resolved here. The harness shows ctgA
// and ctgB.
describe('the LD join a fetch asks for', () => {
  async function fetchedOpts(
    indexSnp: string,
    color?: Record<string, unknown>,
  ) {
    const { createDisplay, mockRpcCall } = createTestEnvironment({ color })
    answerFetches(mockRpcCall)
    const { display } = createDisplay({
      displaySnapshot: { indexSnp, indexSnpPinned: true },
    })
    const names = jest
      .spyOn(getSession(display).assemblyManager, 'getRefNameMapForAdapter')
      .mockResolvedValue({ ctgA: 'LD_ctgA', ctgB: 'LD_ctgB' })
    await waitFor(() => {
      expect(display.rpcDataMap.size).toBe(2)
    })
    const optsOn = (refName: string) =>
      callsOf(mockRpcCall, 'CoreGetEncodedLayers').find(
        ([, , args]) => args.region.refName === refName,
      )![2].opts
    return { opts: [optsOn('ctgA'), optsOn('ctgB')], names }
  }

  it("names a placed index by its start and the region's contig in the LD file's spelling", async () => {
    const { opts } = await fetchedOpts('chrA:501', { field: 'ld' })
    expect(opts).toEqual([
      { ld: { index: { start: 500 }, refName: 'LD_ctgA' } },
      undefined,
    ])
  })

  it('names an index known only by id, on every region', async () => {
    const { opts } = await fetchedOpts('rs1', { field: 'ld' })
    expect(opts).toEqual([
      { ld: { index: { name: 'rs1' }, refName: 'LD_ctgA' } },
      { ld: { index: { name: 'rs1' }, refName: 'LD_ctgB' } },
    ])
  })

  // Resolving the LD file's names reads its refNames, which for the in-memory
  // PLINK adapter parses the whole `.ld` file: a download a plot coloured any
  // other way must not pay.
  it('resolves nothing outside LD coloring', async () => {
    const { opts, names } = await fetchedOpts('ctgA:501')
    expect(opts).toEqual([undefined, undefined])
    expect(names).not.toHaveBeenCalled()
  })
})
