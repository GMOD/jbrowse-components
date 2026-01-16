import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { modelFactory as LinearFeatureDisplayModelFactory } from './index.ts'
import { stateModelFactory as LinearGenomeViewModelFactory } from '../LinearGenomeView/index.ts'
import {
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from '../index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Mock feature data that would be returned by RPC
const mockFeatureData = {
  uniqueId: 'feature1',
  refName: 'ctgA',
  start: 100,
  end: 200,
  name: 'TestFeature',
  customAttr: 'custom value',
  locus_tag: 'LOCUS_001',
  gene_name: 'geneA',
}

function createTestEnvironment() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  // Create a config schema for LinearFeatureDisplay that includes mouseover from base
  const linearFeatureDisplayConfigSchema = ConfigurationSchema(
    'LinearFeatureDisplay',
    {
      renderer: ConfigurationSchema('CanvasFeatureRenderer', {}),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )

  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        configSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearFeatureDisplay',
      configSchema: linearFeatureDisplayConfigSchema,
      stateModel: LinearFeatureDisplayModelFactory(
        linearFeatureDisplayConfigSchema,
      ),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

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
      assemblyManager: {
        get: () => ({
          regions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 50000,
              assemblyName: 'volvox',
            },
          ],
          getCanonicalRefName: (refName: string) => refName,
        }),
        waitForAssembly: () =>
          Promise.resolve({
            regions: [
              {
                refName: 'ctgA',
                start: 0,
                end: 50000,
                assemblyName: 'volvox',
              },
            ],
            getCanonicalRefName: (refName: string) => refName,
          }),
        isValidRefName: () => true,
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

  return { Session, LinearGenomeModel, mockRpcCall, pluginManager }
}

describe('LinearFeatureDisplay mouseover behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('fetches feature via RPC when featureIdUnderMouse is set', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockRpcCall.mockResolvedValue({ feature: mockFeatureData })

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const track = view.tracks[0]
    const display = track?.displays[0]

    expect(display).toBeDefined()
    expect(display?.featureIdUnderMouse).toBeUndefined()
    expect(display?.featureUnderMouse).toBeUndefined()

    // Set featureIdUnderMouse to trigger the reaction
    display?.setFeatureIdUnderMouse('feature1')

    // The reaction has a 50ms delay
    jest.advanceTimersByTime(100)

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalledWith(
        expect.any(String),
        'CoreGetFeatureDetails',
        expect.objectContaining({
          featureId: 'feature1',
        }),
      )
    })

    await waitFor(() => {
      expect(display?.featureUnderMouse).toBeDefined()
      expect(display?.featureUnderMouse?.get('name')).toBe('TestFeature')
      expect(display?.featureUnderMouse?.get('customAttr')).toBe('custom value')
    })
  })

  test('clears featureUnderMouse when featureIdUnderMouse is cleared', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockRpcCall.mockResolvedValue({ feature: mockFeatureData })

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // First set a feature
    display?.setFeatureIdUnderMouse('feature1')
    jest.advanceTimersByTime(100)

    await waitFor(() => {
      expect(display?.featureUnderMouse).toBeDefined()
    })

    // Now clear it
    display?.setFeatureIdUnderMouse(undefined)
    jest.advanceTimersByTime(100)

    await waitFor(() => {
      expect(display?.featureUnderMouse).toBeUndefined()
    })
  })

  test('discards stale RPC response when featureId changes', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // First call takes longer, second call resolves faster
    let resolveFirst: (value: { feature: typeof mockFeatureData }) => void
    const firstPromise = new Promise<{ feature: typeof mockFeatureData }>(
      resolve => {
        resolveFirst = resolve
      },
    )

    const secondFeatureData = {
      ...mockFeatureData,
      uniqueId: 'feature2',
      name: 'SecondFeature',
    }

    mockRpcCall
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ feature: secondFeatureData })

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // Set first feature ID
    display?.setFeatureIdUnderMouse('feature1')
    jest.advanceTimersByTime(100)

    // Quickly change to second feature before first resolves
    display?.setFeatureIdUnderMouse('feature2')
    jest.advanceTimersByTime(100)

    // Wait for second RPC to complete
    await waitFor(() => {
      expect(display?.featureUnderMouse?.get('name')).toBe('SecondFeature')
    })

    // Now resolve the first (stale) request
    resolveFirst!({ feature: mockFeatureData })

    // The stale response should be ignored - feature should still be SecondFeature
    await waitFor(() => {
      expect(display?.featureUnderMouse?.get('name')).toBe('SecondFeature')
    })
  })

  test('handles RPC errors gracefully without crashing', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockRpcCall.mockRejectedValue(new Error('RPC failed'))

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // Set featureIdUnderMouse - this should not throw
    display?.setFeatureIdUnderMouse('feature1')
    jest.advanceTimersByTime(100)

    // Run all timers and flush promises to allow error handling to complete
    await jest.runAllTimersAsync()

    // Should not crash, featureUnderMouse should remain undefined
    expect(display?.featureUnderMouse).toBeUndefined()
  })

  test('mouseover jexl expression can access feature properties via get()', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockRpcCall.mockResolvedValue({ feature: mockFeatureData })

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]
    expect(display).toBeDefined()

    // Set custom mouseover config that uses get(feature, 'property') - this is the
    // pattern that was broken in the bug report
    display?.configuration.mouseover.set(
      "jexl:get(feature,'gene_name') || get(feature,'locus_tag') || get(feature,'name')",
    )

    // Before hovering, featureUnderMouse should be undefined
    expect(display?.featureUnderMouse).toBeUndefined()

    // Set featureIdUnderMouse to trigger the reaction
    display?.setFeatureIdUnderMouse('feature1')
    jest.advanceTimersByTime(100)

    // Wait for feature to be fetched
    await waitFor(() => {
      expect(display?.featureUnderMouse).toBeDefined()
    })

    // Now test that the mouseover config evaluates correctly with the feature
    // This is the key test - it verifies that get(feature, 'property') works
    const mouseoverResult = getConf(display, 'mouseover', {
      feature: display?.featureUnderMouse,
    })

    // Should return 'geneA' (the gene_name field from mockFeatureData)
    expect(mouseoverResult).toBe('geneA')
  })

  test('mouseover with complex jexl expression using feature properties', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Feature without gene_name to test fallback behavior
    const featureWithoutGeneName = {
      uniqueId: 'feature2',
      refName: 'ctgA',
      start: 100,
      end: 200,
      name: 'FallbackName',
      locus_tag: 'LOCUS_002',
    }

    mockRpcCall.mockResolvedValue({ feature: featureWithoutGeneName })

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // Set mouseover with fallback chain like in the bug report
    display?.configuration.mouseover.set(
      "jexl:get(feature,'gene_name') || get(feature,'locus_tag') || get(feature,'name')",
    )

    display?.setFeatureIdUnderMouse('feature2')
    jest.advanceTimersByTime(100)

    await waitFor(() => {
      expect(display?.featureUnderMouse).toBeDefined()
    })

    const mouseoverResult = getConf(display, 'mouseover', {
      feature: display?.featureUnderMouse,
    })

    // Should fall back to locus_tag since gene_name is not present
    expect(mouseoverResult).toBe('LOCUS_002')
  })

  test('default mouseover uses mouseoverExtraInformation when feature is undefined', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Simulate the case where RPC hasn't completed yet but we have mouseoverExtraInformation
    mockRpcCall.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    )

    const session = Session.create(
      {
        configuration: {},
      },
      { pluginManager },
    )
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_track',
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // Set mouseoverExtraInformation (this is set by CanvasFeatureRendering)
    display?.setMouseoverExtraInformation('Tooltip from renderer')
    display?.setFeatureIdUnderMouse('feature1')

    // Don't advance timers - RPC won't complete
    // featureUnderMouse should still be undefined
    expect(display?.featureUnderMouse).toBeUndefined()

    // But the default mouseover should still work using mouseoverExtraInformation
    const mouseoverResult = getConf(display, 'mouseover', {
      feature: undefined,
      mouseoverExtraInformation: display?.mouseoverExtraInformation,
    })

    expect(mouseoverResult).toBe('Tooltip from renderer')
  })
})
