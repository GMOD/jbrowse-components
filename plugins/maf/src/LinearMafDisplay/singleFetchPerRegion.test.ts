import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { waitFor } from '@testing-library/react'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// A LinearMafGetAlignmentData result with no blocks; `samples` is what each test
// varies, since that (not the block content) is what drives the cache key here.
function makeMafResult(samples: { id: string; label: string }[]) {
  return {
    samples,
    treeNewick: undefined,
    regionData: {
      blocks: [],
      coverage: {
        coverageDepths: new Float32Array(0),
        coverageStartPos: 0,
        coverageMaxDepth: 0,
        identityScores: new Float32Array(0),
        mismatchPositions: new Uint32Array(0),
        mismatchBases: new Uint8Array(0),
        insertionPositions: new Uint32Array(0),
        insertionLengths: new Uint32Array(0),
        coveragePackedBuffer: { data: new Uint8Array(0), width: 0, height: 0 },
        snpPackedBuffer: new ArrayBuffer(0),
        interbasePackedBuffer: new ArrayBuffer(0),
        interbaseMaxCount: 0,
        indicatorPackedBuffer: new ArrayBuffer(0),
      },
    },
  }
}

function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  // MAF's configSchema reads baseLinearDisplayConfigSchema off the installed
  // LinearGenomeViewPlugin's exports, so the real plugin must be registered.
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema: ConfigurationSchema(
          'MafTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaF(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MafTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MafTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MafTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MafTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'MafTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      // No `samples` slot on the adapter → sample-discovery path.
      adapter: { type: 'MafTabixAdapter' },
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: {
        call: mockRpcCall,
      },
      theme: createJBrowseTheme(),
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox'
            ? {
                initialized: true,
                regions: [
                  {
                    refName: 'ctgA',
                    start: 0,
                    end: 50_000,
                    assemblyName: 'volvox',
                  },
                ],
                getCanonicalRefName: (refName: string) => refName,
                configuration: { sequence: undefined },
              }
            : undefined,
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notifyError() {},
      queueDialog() {},
    }))

  function createDisplay() {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'MafTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMafDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    const track = view.tracks[0]!
    const display = track.displays[0]!
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}

const HG38_MM10 = [
  { id: 'hg38', label: 'hg38' },
  { id: 'mm10', label: 'mm10' },
]

// Run the fetch autorun to quiescence: each pass advances past the 600 ms
// FetchVisibleRegions debounce and drains the RPC promises, so any refetch
// SettingsInvalidate schedules gets a chance to run and be counted.
async function settle(display: { loadedRegions: { size: number } }) {
  for (let i = 0; i < 6; i++) {
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
  }
}

function alignmentCalls(mockRpcCall: jest.Mock) {
  return mockRpcCall.mock.calls.filter(
    c => c[1] === 'LinearMafGetAlignmentData',
  )
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('LinearMafDisplay alignment fetch count', () => {
  // Regression: `rpcProps()` used to return `orderedSampleIds`, which is derived
  // from the fetch result — undefined before the first one, defined after. That
  // flipped `rpcPropsCacheKey` the moment the samples landed, so
  // SettingsInvalidate discarded the region that had just arrived and the whole
  // (heaviest-in-the-plugin) payload was downloaded a second time on every single
  // track load.
  it('fetches a region once when the sample set is stable', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation(() =>
      Promise.resolve(makeMafResult(HG38_MM10)),
    )
    const { display } = createDisplay()
    await settle(display)

    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)
    // the row order still reaches the worker — only the *cache key* changed
    expect(display.orderedSampleIds).toEqual(['hg38', 'mm10'])
  })

  // The other half of that trade: dropping the derived key also dropped an
  // accidental repair. A sample-discovery track can report a different genome set
  // per region, and rows already fetched carry `rowIndex`es assigned against the
  // old set, so the change has to invalidate them explicitly.
  it('refetches when the worker reports a changed sample set', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation(() =>
      Promise.resolve(makeMafResult(HG38_MM10)),
    )
    const { display } = createDisplay()
    await settle(display)
    expect(alignmentCalls(mockRpcCall)).toHaveLength(1)
    expect(display.sampleSetGeneration).toBe(0)

    mockRpcCall.mockImplementation(() =>
      Promise.resolve(
        makeMafResult([...HG38_MM10, { id: 'rn6', label: 'rn6' }]),
      ),
    )
    display.reload()
    await settle(display)

    expect(display.sampleSetGeneration).toBe(1)
    expect(display.orderedSampleIds).toEqual(['hg38', 'mm10', 'rn6'])
    // the reload's fetch, plus the one the changed set invalidated it into
    expect(alignmentCalls(mockRpcCall)).toHaveLength(3)
  })
})
