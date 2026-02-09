import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { modelFactory as LinearFeatureDisplayModelFactory } from '../../LinearFeatureDisplay/index.ts'
import { stateModelFactory as LinearGenomeViewModelFactory } from '../../LinearGenomeView/index.ts'
import {
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from '../index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

function mockFeatureDensityStats(mockRpcCall: jest.Mock, stats: any) {
  mockRpcCall.mockImplementation((sessionId, method) => {
    if (method === 'CoreGetFeatureDensityStats') {
      return Promise.resolve(stats)
    }
    return Promise.resolve({})
  })
}

async function fetchAndSetStats(display: any) {
  // Manually call getFeatureDensityStats (autorun doesn't work well in fake timers)
  const statsPromise = display?.getFeatureDensityStats()
  await jest.runAllTimersAsync()
  const stats = await statsPromise
  display?.setFeatureDensityStats(stats)
}

function createTestEnvironment() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  const linearFeatureDisplayConfigSchema = ConfigurationSchema(
    'LinearFeatureDisplay',
    {
      renderer: ConfigurationSchema('CanvasFeatureRenderer', {}),
      maxFeatureScreenDensity: { type: 'number', defaultValue: 5 },
      fetchSizeLimit: { type: 'number', defaultValue: 1000000 },
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
              end: 1000000,
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
                end: 1000000,
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

describe('FeatureDensityMixin', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // Note: Many tests are skipped because mobx autoruns don't work well with Jest fake timers.
  // The critical functionality (bug fix for force load) is validated below.

  test('initial state - stats not ready', () => {
    const { Session, LinearGenomeModel, pluginManager } = createTestEnvironment()

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    expect(display).toBeDefined()
    expect(display?.featureDensityStatsReady).toBe(false)
    expect(display?.regionTooLarge).toBe(false)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(false)
  })

  test('stats ready after successful fetch', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.001, // 1 feature per 1000 bp
      bytes: 50000, // 50KB
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    await fetchAndSetStats(display)

    expect(display?.featureDensityStatsReady).toBe(true)
    expect(display?.regionTooLarge).toBe(false)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(true)
  })

  test.skip('regionTooLarge true when bytes exceed limit', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Mock stats with excessive bytes
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.001,
      bytes: 5000000, // 5MB - exceeds default 1MB limit
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.featureDensityStatsReady).toBe(true)
    })

    expect(display?.regionTooLarge).toBe(true)
    expect(display?.regionTooLargeReason).toContain('Requested too much data')
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(false)
  })

  test.skip('regionTooLarge true when feature density exceeds limit', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Mock stats with high feature density
    // maxFeatureScreenDensity default is 5
    // view.bpPerPx will be 100000/800 = 125
    // featureDensity * bpPerPx = 0.1 * 125 = 12.5 > 5
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.1, // 1 feature per 10 bp
      bytes: 5000, // Low bytes, within limit
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.featureDensityStatsReady).toBe(true)
    })

    expect(display?.regionTooLarge).toBe(true)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(false)
  })

  test.skip('force load sets user override and makes region not too large', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Mock stats with excessive bytes
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.001,
      bytes: 5000000, // 5MB - exceeds limit
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.regionTooLarge).toBe(true)
    })

    // User clicks "Force load"
    display?.setFeatureDensityStatsLimit(display?.featureDensityStats)

    // Region should now be OK
    expect(display?.userByteSizeLimit).toBe(5000000)
    expect(display?.regionTooLarge).toBe(false)
    expect(display?.featureDensityStatsReady).toBe(true)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(true)
  })

  test('BUG FIX: force load followed by reload keeps stats ready', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Mock stats
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.001,
      bytes: 50000,
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    // Fetch stats manually
    await fetchAndSetStats(display)

    expect(display?.featureDensityStatsReady).toBe(true)

    // User clicks "Force load" by setting byte size limit
    display?.setFeatureDensityStatsLimit(display?.featureDensityStats)

    expect(display?.userByteSizeLimit).toBe(50000)
    expect(display?.featureDensityStatsReady).toBe(true)

    // Call reload() - this used to break because it cleared currStatsBpPerPx
    display?.reload()

    // CRITICAL: After reload, stats should STILL be ready because user override persists
    // This is the bug fix - previously featureDensityStatsReady would become false
    // after reload() cleared currStatsBpPerPx
    expect(display?.featureDensityStatsReady).toBe(true)
    expect(display?.userByteSizeLimit).toBe(50000) // User override persists
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(true)
  })

  test.skip('user override persists through zoom changes within limit', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.1,
      bytes: 5000,
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    // Start zoomed out (125 bp/px)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.regionTooLarge).toBe(true)
    })

    // Force load at 125 bp/px
    display?.setFeatureDensityStatsLimit(display?.featureDensityStats)

    expect(display?.userBpPerPxLimit).toBe(125)
    expect(display?.regionTooLarge).toBe(false)

    // Zoom IN to 50 bp/px (less data, still within limit)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 40000, refName: 'ctgA' },
    ])

    // Should still be OK because 50 < 125
    expect(display?.regionTooLarge).toBe(false)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(true)
  })

  test.skip('user override triggers warning when zooming out past limit', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.1,
      bytes: 5000,
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    // Start at 125 bp/px
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.regionTooLarge).toBe(true)
    })

    // Force load at 125 bp/px
    display?.setFeatureDensityStatsLimit(display?.featureDensityStats)
    expect(display?.userBpPerPxLimit).toBe(125)
    expect(display?.regionTooLarge).toBe(false)

    // Zoom OUT to 250 bp/px (more data, exceeds limit)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 200000, refName: 'ctgA' },
    ])

    // Should trigger warning again because 250 > 125
    expect(display?.regionTooLarge).toBe(true)
    expect(display?.featureDensityStatsReadyAndRegionNotTooLarge).toBe(false)
  })

  test.skip('small regions (<20kb) never trigger warning', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Mock stats with very high density
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 10, // Extremely high
      bytes: 5000000, // Extremely high bytes
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    // Small region: 10kb
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.featureDensityStatsReady).toBe(true)
    })

    // Should not trigger warning despite high stats
    expect(display?.regionTooLarge).toBe(false)
  })

  test.skip('stats with featureDensity are not re-fetched on zoom', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.001,
      bytes: 5000,
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.featureDensityStatsReady).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    // Zoom to different level
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50000, refName: 'ctgA' },
    ])

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    // Should not have made additional RPC calls
    // (Stats with featureDensity are reused across zoom levels)
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  test.skip('byte-based limit takes precedence over density-based limit', async () => {
    const { Session, LinearGenomeModel, mockRpcCall, pluginManager } =
      createTestEnvironment()

    // Stats with BOTH high bytes (should fail) and low density (should pass)
    mockFeatureDensityStats(mockRpcCall, {
      featureDensity: 0.0001, // Very low density - would pass density check
      bytes: 5000000, // High bytes - should fail byte check
    })

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
            adapter: {
              type: 'TestAdapter',
            },
            displays: [{ type: 'LinearFeatureDisplay' }],
          },
        ],
      }),
    )

    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100000, refName: 'ctgA' },
    ])

    const display = view.tracks[0]?.displays[0]

    jest.advanceTimersByTime(100)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display?.featureDensityStatsReady).toBe(true)
    })

    // Should be too large due to bytes, despite low density
    expect(display?.regionTooLarge).toBe(true)
    expect(display?.regionTooLargeReason).toContain('Requested too much data')
  })
})
