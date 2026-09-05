import { setConf } from '@jbrowse/core/configuration'
import { getMembers } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Canvas makes no other RPC call, so this responder is the whole mock.
function makeByteGatedRender(bytesPerBp: number) {
  return (
    _sessionId: string,
    _method: string,
    args: { region: { start: number; end: number }; byteLimit?: number },
  ) => {
    const bytes = Math.round((args.region.end - args.region.start) * bytesPerBp)
    return Promise.resolve(
      args.byteLimit !== undefined && bytes > args.byteLimit
        ? { regionTooLarge: true as const, bytes }
        : { ...makeFeatureData(), bytes },
    )
  }
}

function createLargeDisplay(env = createTestEnvironment()) {
  const { display, view, mockRpcCall } = env.createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
  ])
  view.zoomTo(62.5)
  return { display, view, mockRpcCall }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('the gate opt-in survives the display composition order', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.gateEnabled).toBe(true)
})

test('reload() bumps reloadCounter, which is what arms the retry check', () => {
  const { display } = createTestEnvironment().createDisplay()
  const before = display.reloadCounter
  display.reload()
  expect(display.reloadCounter).toBe(before + 1)
})

test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
  expect(actions).not.toContain('rpcProps')
})

describe('FetchVisibleRegions autorun', () => {
  it('fetches regions on initial load', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display, view } = createDisplay()

    expect(view.initialized).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.error).toBeUndefined()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall).toHaveBeenCalledWith(
        expect.any(String),
        'RenderFeatureData',
        expect.objectContaining({
          region: expect.objectContaining({ refName: 'ctgA' }),
        }),
      )
    })

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('does not re-fetch when already loading (prevents re-entry loop)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockImplementation(() => new Promise(() => {}))

    const { display } = createDisplay()

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(2000)

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('does not loop after regionTooLarge is set', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('clears regionTooLarge and re-fetches after force load + reload', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    view.zoomTo(62.5)

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setForceLoadTrack(true)
    mockRpcCall.mockResolvedValue(makeFeatureData())
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
    })
  })

  it('completes fetch and settles even with many regions (collapsed introns)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { view, display } = createDisplay()

    const regions = Array.from({ length: 5 }, (_, i) => ({
      assemblyName: 'volvox',
      start: i * 1000,
      end: i * 1000 + 300,
      refName: 'ctgA',
    }))
    view.setDisplayedRegions(regions)

    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'RenderFeatureData') {
        return Promise.resolve(makeFeatureData())
      }
      return Promise.resolve({})
    })

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })

    const finalCallCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(2000)
    expect(mockRpcCall.mock.calls.length).toBe(finalCallCount)
  })

  it('fetch error sets display error and stops retrying', async () => {
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('network failure')
    reported.mockRestore()

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(2000)
    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('preserves laidOutDataMap during layout refresh (soft reset)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const featureData = makeFeatureData()
    mockRpcCall.mockResolvedValue(featureData)

    const { display, view } = createDisplay()

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(display.laidOutDataMap.size).toBe(1)

    const originalBpPerPx = view.bpPerPx
    view.zoomTo(originalBpPerPx * 3)

    jest.advanceTimersByTime(800)

    expect(display.laidOutDataMap.size).toBe(1)

    await waitFor(() => {
      expect(display.isLoading).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('reload after error clears error and re-fetches successfully', async () => {
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    const { display } = createDisplay()

    mockRpcCall.mockRejectedValue(new Error('network failure'))

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.error).toBeTruthy()
    })
    expect(`${reported.mock.calls[0]?.[0]}`).toContain('network failure')
    reported.mockRestore()

    mockRpcCall.mockResolvedValue(makeFeatureData())
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.error).toBeFalsy()
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  describe('the peptide threshold refetches and no other zoom under 100 bp/px does', () => {
    async function loadedAboveTheThreshold() {
      const { createDisplay, mockRpcCall } = createTestEnvironment()
      mockRpcCall.mockResolvedValue(makeFeatureData())
      const { display, view } = createDisplay()
      view.zoomTo(2)

      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      await waitFor(() => {
        expect(display.loadedRegions.size).toBe(1)
      })
      return { display, view, mockRpcCall }
    }

    it('does not refetch on a zoom that stays above it', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(1.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    })

    it('refetches on a zoom that crosses it', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(0.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      await waitFor(() => {
        expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
      })
    })

    it('does not refetch on a crossing zoom with amino acids off', async () => {
      const { display, view, mockRpcCall } = await loadedAboveTheThreshold()
      view.setShowAminoAcids(false)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(0.5)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(display.zoomFetchKey).toBe('false|all')
      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    })
  })

  describe('the gene-glyph auto threshold', () => {
    async function loadedCollapsed(mode?: 'all') {
      const { createDisplay, mockRpcCall } = createTestEnvironment()
      mockRpcCall.mockResolvedValue(makeFeatureData())
      const { display, view } = createDisplay()
      if (mode) {
        display.setGeneGlyphMode(mode)
      }
      view.setDisplayedRegions([
        { assemblyName: 'volvox', start: 0, end: 500_000, refName: 'ctgA' },
      ])
      view.zoomTo(200)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      await waitFor(() => {
        expect(display.loadedRegions.size).toBe(1)
      })
      return { display, view, mockRpcCall }
    }

    it('rides in the zoom key and the RPC call, not in rpcProps', async () => {
      const { display, view, mockRpcCall } = await loadedCollapsed()
      const settings = display.settingsFetchInputs
      expect(display.zoomFetchKey).toBe('false|longestCoding')
      expect(mockRpcCall.mock.lastCall?.[2]).toMatchObject({
        displayConfig: { geneGlyphMode: 'longestCoding' },
      })
      expect(display.rpcProps().displayConfig).not.toHaveProperty(
        'geneGlyphMode',
      )

      view.zoomTo(50)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      await waitFor(() => {
        expect(mockRpcCall.mock.lastCall?.[2]).toMatchObject({
          displayConfig: { geneGlyphMode: 'all' },
        })
      })
      expect(display.zoomFetchKey).toBe('false|all')
      expect(display.settingsFetchInputs).toEqual(settings)
      expect(display.staleSettingsDrawn).toBe(false)
    })

    it('does not move for a fixed mode', async () => {
      const { display, view, mockRpcCall } = await loadedCollapsed('all')
      const callsBefore = mockRpcCall.mock.calls.length

      view.zoomTo(50)
      expect(display.viewportWithinLoadedData).toBe(true)
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(display.zoomFetchKey).toBe('false|all')
      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    })

    it('an opened gene refetches under longestCoding, scrim-free', async () => {
      const { display, mockRpcCall } = await loadedCollapsed()
      const settings = display.settingsFetchInputs
      const callsBefore = mockRpcCall.mock.calls.length

      display.toggleExpandedGene('gene1')
      expect(display.rpcProps()).not.toHaveProperty('expandedGeneIds')
      expect(display.zoomFetchKey).toBe('false|longestCoding|gene1')
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      await waitFor(() => {
        expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
      })
      expect(mockRpcCall.mock.lastCall?.[2]).toMatchObject({
        expandedGeneIds: ['gene1'],
      })
      expect(display.settingsFetchInputs).toEqual(settings)
      expect(display.staleSettingsDrawn).toBe(false)
    })

    it('an opened gene refetches nothing under all', async () => {
      const { display, mockRpcCall } = await loadedCollapsed('all')
      const callsBefore = mockRpcCall.mock.calls.length

      display.toggleExpandedGene('gene1')
      expect(display.zoomFetchKey).toBe('false|all')
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()

      expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    })
  })

  it('re-fetches a region pruned off-screen when it scrolls back into view', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display, view } = createDisplay()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
      expect(display.rpcDataMap.size).toBe(1)
    })

    const callsAfterLoad = mockRpcCall.mock.calls.length

    display.dropLoadedRegion(0)

    expect(display.rpcDataMap.size).toBe(0)
    expect(display.loadedRegions.size).toBe(0)

    view.zoomTo(view.bpPerPx * 1.1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
      expect(display.rpcDataMap.size).toBe(1)
    })

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsAfterLoad)
  })

  it('clearAllRpcData resets state and triggers a new fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockResolvedValue(makeFeatureData())

    const { display } = createDisplay()

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length

    display.clearAllRpcData()

    expect(display.loadedRegions.size).toBe(0)
    expect(display.isLoading).toBe(false)

    jest.advanceTimersByTime(800)

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

describe('SettingsInvalidate autorun', () => {
  it('triggers refetch when settings change while data is loaded', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setShowOnlyGenes(true)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
      const lastArgs = mockRpcCall.mock.calls.at(-1)![2]
      expect(lastArgs).toMatchObject({ showOnlyGenes: true })
    })
  })

  it('keeps stale rpcDataMap visible through a settings-change refetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.rpcDataMap.size).toBe(1)
    display.markCanvasDrawn()
    expect(display.displayPhase).toBe('ready')

    display.setShowOnlyGenes(true)
    expect(display.rpcDataMap.size).toBe(1)
    expect(display.loadedRegions.size).toBe(1)
    expect(display.staleSettingsDrawn).toBe(true)
    expect(display.displayPhase).toBe('loading')
  })

  it('triggers refetch when settings change while fetch is in progress (regression)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()

    mockRpcCall.mockImplementation(() => new Promise(() => {}))
    const { display } = createDisplay()

    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setShowOnlyGenes(true)
    jest.advanceTimersByTime(800)

    // waitFor, not a bare read: fetchRegions consults the async byte gate
    // before the RPC, so the call lands a microtask after the timer.
    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
    const lastArgs = mockRpcCall.mock.calls.at(-1)![2]
    expect(lastArgs).toMatchObject({ showOnlyGenes: true })
  })

  it('does not double-fetch when settings change before the initial FetchVisibleRegions fires', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display } = createDisplay()

    display.setShowOnlyGenes(true)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(mockRpcCall).toHaveBeenCalledTimes(1)
    expect(mockRpcCall.mock.calls[0]![2]).toMatchObject({ showOnlyGenes: true })
  })
})

describe('byte estimate pre-check', () => {
  it('sets regionTooLarge from the byte short-circuit (no features loaded)', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    expect(display.laidOutDataMap.size).toBe(0)
  })

  it('proceeds to fetch when bytes are within limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(1))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })

    const renderCalls = mockRpcCall.mock.calls.filter(
      (c: unknown[]) => c[1] === 'RenderFeatureData',
    )
    expect(renderCalls.length).toBeGreaterThan(0)
  })

  it('does not gate a multi-region view whose regions each fit but sum over the limit', async () => {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 1_500_000, refName: 'ctgA' },
      {
        assemblyName: 'volvox',
        start: 1_500_000,
        end: 3_000_000,
        refName: 'ctgA',
      },
      {
        assemblyName: 'volvox',
        start: 3_000_000,
        end: 4_500_000,
        refName: 'ctgA',
      },
    ])
    view.showAllRegions()

    env.mockRpcCall.mockImplementation(makeByteGatedRender(2))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(3)
    })
    expect(display.regionTooLarge).toBe(false)
    expect(display.laidOutDataMap.size).toBeGreaterThan(0)
  })

  it('allows fetch after force load raises the byte size limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.forceLoad()
    display.reload()

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('does not loop after byte-estimate regionTooLarge is set', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('does not loop after a refusal ends a multi-region batch early', async () => {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 1_500_000, refName: 'ctgA' },
      {
        assemblyName: 'volvox',
        start: 1_500_000,
        end: 3_000_000,
        refName: 'ctgA',
      },
      {
        assemblyName: 'volvox',
        start: 3_000_000,
        end: 4_500_000,
        refName: 'ctgA',
      },
    ])
    view.showAllRegions()

    env.mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedRegions.size).toBe(0)

    const callCount = env.mockRpcCall.mock.calls.length
    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(env.mockRpcCall.mock.calls.length).toBe(callCount)
  })

  it('force load refetches every region a cancelled batch skipped', async () => {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 1_500_000, refName: 'ctgA' },
      {
        assemblyName: 'volvox',
        start: 1_500_000,
        end: 3_000_000,
        refName: 'ctgA',
      },
      {
        assemblyName: 'volvox',
        start: 3_000_000,
        end: 4_500_000,
        refName: 'ctgA',
      },
    ])
    view.showAllRegions()

    env.mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedRegions.size).toBe(0)

    display.forceLoad()
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(3)
    })
  })

  it('releases the banner when a later viewport fits', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    mockRpcCall.mockImplementation(makeByteGatedRender(1))
    view.zoomTo(1)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })
})

describe('adapter fetchSizeLimit in the byte gate', () => {
  it('lets a region through that fits the adapter limit but not the display config', async () => {
    const { display, mockRpcCall } = createLargeDisplay(
      createTestEnvironment({ adapterFetchSizeLimit: 50_000_000 }),
    )

    expect(display.adapterFetchSizeLimit).toBe(50_000_000)
    expect(display.resolvedByteLimit()).toBe(50_000_000)

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.gateByteLimit).toBe(50_000_000)
  })

  it('falls back to the display config when the adapter declares no limit', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    expect(display.adapterFetchSizeLimit).toBeUndefined()
    expect(display.resolvedByteLimit()).toBe(display.configuredFetchSizeLimit)

    mockRpcCall.mockImplementation(makeByteGatedRender(200))
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
  })
})

describe('gate budgets are not RPC cache keys', () => {
  it('keeps the cache key stable across the force-load floor', () => {
    const { display, view } = createLargeDisplay()

    view.zoomTo(62.5)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.resolvedByteLimit()).toBeDefined()
    expect(display.maxFeatureDensity).toBeDefined()
    const above = display.rpcPropsCacheKey

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.resolvedByteLimit()).toBeDefined()
    expect(display.rpcPropsCacheKey).toBe(above)
  })

  it('keeps the cache key stable when a budget slot is edited', () => {
    const { display, view } = createLargeDisplay()
    view.zoomTo(62.5)
    const before = display.rpcPropsCacheKey

    setConf(display, 'maxFeatureScreenDensity', 42)
    setConf(display, 'fetchSizeLimit', 12_345)
    expect(display.rpcPropsCacheKey).toBe(before)
  })

  it('a raised fetchSizeLimit releases the gate through the verdict', async () => {
    const { display, mockRpcCall } = createLargeDisplay()
    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.loadedRegions.size).toBe(0)

    setConf(display, 'fetchSizeLimit', 100_000_000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })
  })
})

describe('derived regionTooLarge', () => {
  it('stays true on small zoom while density still trips threshold', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCount = mockRpcCall.mock.calls.length

    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()
    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)
  })

  it('re-measures when a filter changes under the banner', async () => {
    const { display, mockRpcCall } = createLargeDisplay()
    mockRpcCall.mockResolvedValue({ regionTooLarge: true, featureCount: 5000 })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.gateMeasurementStale).toBe(false)
    const callCount = mockRpcCall.mock.calls.length

    mockRpcCall.mockResolvedValue(makeFeatureData())
    setConf(display, 'jexlFilters', ["jexl:get(feature,'type')=='nothing'"])
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callCount + 1)
    expect(display.regionTooLarge).toBe(false)
  })

  it('keeps offering zoom on a density block once the bytes go flat', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 500_000, refName: 'ctgA' },
    ])
    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 50_000,
      bytes: 200_000,
    })

    view.zoomTo(1000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    const wideSpan = view.visibleBp

    view.zoomTo(250)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.byteEstimate?.zoomIneffective).toBe(true)
    })
    expect(view.visibleBp).toBeLessThanOrEqual(wideSpan / 2)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    expect(display.regionTooLargeReason).toBe('Too many features')
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  it('flips false and refetches when visibleBp drops below the gate', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    let renderCalls = 0
    mockRpcCall.mockImplementation(() => {
      renderCalls += 1
      return renderCalls === 1
        ? Promise.resolve({ regionTooLarge: true, featureCount: 5000 })
        : Promise.resolve(makeFeatureData())
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    view.zoomTo(20)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(renderCalls).toBeGreaterThanOrEqual(2)
  })

  it('preserves density stats across viewport-change clearAllRpcData', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    view.zoomTo(55)
    jest.advanceTimersByTime(100)

    expect(display.densityStatsPerRegion.size).toBe(1)
    expect(display.regionTooLarge).toBe(true)
  })

  it('clears stale density stats on chromosome (displayedRegions) change', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.densityStatsPerRegion.size).toBe(1)
    })

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgB' },
    ])

    expect(display.densityStatsPerRegion.size).toBe(0)
    expect(display.byteEstimate).toBeUndefined()
  })

  it('force load past the byte estimate flips banner false and renders', async () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view, mockRpcCall } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])

    mockRpcCall.mockImplementation(makeByteGatedRender(2))

    view.zoomTo(view.maxBpPerPx)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.forceLoad()
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })
    expect(display.regionTooLarge).toBe(false)
  })

  it('force load with density limit flips banner false via derived recomputation', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    let renderCalls = 0
    mockRpcCall.mockImplementation(() => {
      renderCalls += 1
      return renderCalls === 1
        ? Promise.resolve({ regionTooLarge: true, featureCount: 1500 })
        : Promise.resolve(makeFeatureData())
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
  })

  it('banner UI surfaces reflect derived regionTooLarge', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    expect(display.regionTooLargeReason).toBe('Too many features')
  })

  it('laidOutDataMap is empty while regionTooLarge is true', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 5000,
    })

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    expect(display.laidOutDataMap.size).toBe(0)
  })

  it('byte-estimate banner stays stable across viewport change (no flicker)', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockImplementation(makeByteGatedRender(200))

    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    const callCountBefore = mockRpcCall.mock.calls.length
    view.zoomTo(55)
    jest.advanceTimersByTime(2000)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(mockRpcCall.mock.calls.length).toBe(callCountBefore + 1)
  })

  it('byte-estimate banner self-releases on zoom back in', async () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view, mockRpcCall } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])

    mockRpcCall.mockImplementation(makeByteGatedRender(2))

    view.zoomTo(view.maxBpPerPx)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    const callsWhileTooLarge = mockRpcCall.mock.calls.length

    view.zoomTo(62.5)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(false)
      expect(display.loadedRegions.size).toBeGreaterThan(0)
    })
    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsWhileTooLarge)
  })
})

describe('force-load exempts the whole track', () => {
  it('clears a density rejection without disturbing the byte budget', async () => {
    const { display, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 1500,
      bytes: 100_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.byteEstimate?.bytes).toBe(100_000)
    const budgetBefore = display.gateByteLimit

    display.forceLoad()

    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.resolvedByteLimit()).toBeUndefined()
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.gateByteLimit).toBe(budgetBefore)

    display.setForceLoadTrack(false)
    expect(display.resolvedByteLimit()).toBe(budgetBefore)
    expect(display.regionTooLarge).toBe(true)
  })

  it('preserves an adapter ceiling across force-load and revoke', async () => {
    const { display, mockRpcCall } = createLargeDisplay(
      createTestEnvironment({ adapterFetchSizeLimit: 50_000_000 }),
    )
    expect(display.resolvedByteLimit()).toBe(50_000_000)

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 1500,
      bytes: 100_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.forceLoad()
    expect(display.resolvedByteLimit()).toBeUndefined()

    display.setForceLoadTrack(false)
    expect(display.resolvedByteLimit()).toBe(50_000_000)
  })

  it('survives chromosome navigation', async () => {
    const { display, view, mockRpcCall } = createLargeDisplay()

    mockRpcCall.mockResolvedValue({
      regionTooLarge: true,
      featureCount: 10_000,
    })
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 40_000, refName: 'ctgA' },
    ])
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })
})

// Settles the debounced `coarseBpPerPx` deterministically rather than pumping
// fake timers.
function zoomAndSettle(view: LinearGenomeViewModel, bpPerPx: number) {
  view.zoomTo(bpPerPx)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
}

describe('showLabels auto density gate', () => {
  function setup() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    // A never-resolving RPC keeps the manually seeded density stats the only
    // ones in play.
    env.mockRpcCall.mockReturnValue(new Promise(() => {}))
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 50_000, refName: 'ctgA' },
    ])
    return { display, view, mockRpcCall: env.mockRpcCall }
  }

  it('reacts to zoom from cached stats without a refetch', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })

    zoomAndSettle(view, 62.5)
    expect(view.bpPerPx).toBeGreaterThan(20)
    expect(display.showLabels).toBe(false)

    zoomAndSettle(view, 10)
    expect(view.bpPerPx).toBeLessThan(20)
    expect(display.showLabels).toBe(true)
    expect(display.densityStatsPerRegion.get(0)?.featureCount).toBe(500)
  })

  it('a pinned rung shows names even above the density threshold', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('nameAndDescription')
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(true)
  })

  it('"none" hides names even at low density', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('none')
    zoomAndSettle(view, 20)
    expect(display.showLabels).toBe(false)
  })

  it('auto density gate hides descriptions together with labels', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('auto drops descriptions a zoom tier before names', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })

    zoomAndSettle(view, 5)
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(true)

    zoomAndSettle(view, 15)
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('never leaves descriptions on past the label threshold', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    setConf(display, 'maxDescriptionFeatureDensity', 10)
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('"description" paints descriptions with no name, past the density gate', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setShowLabels('description')
    zoomAndSettle(view, 62.5)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(true)
  })

  function featuresOver(n: number, start: number, end: number) {
    const step = (end - start) / n
    return makeFeatureData({
      flatbushItems: Array.from({ length: n }, (_, i) => {
        const at = Math.round(start + i * step)
        return makeFlatbushItem({
          featureId: `f${i}`,
          startBp: at,
          endBp: at + 1,
        })
      }),
    })
  }

  it('keeps names where the on-screen count is sparse and the average is not', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    display.setRpcData(0, featuresOver(4, 0, 50_000), {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 50_000,
    })
    zoomAndSettle(view, 62.5)

    expect(display.visibleFeatureDensityPerPx).toBeGreaterThan(0.2)
    expect(display.labelDensityPerPx).toBeLessThan(0.2)
    expect(display.showLabels).toBe(true)
  })

  it('drops names where the on-screen count is crowded and the average is not', () => {
    const { display, view } = setup()
    display.setRpcData(0, featuresOver(200, 0, 50_000), {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 50_000,
    })
    zoomAndSettle(view, 62.5)

    expect(display.visibleFeatureDensityPerPx).toBe(0)
    expect(display.labelDensityPerPx).toBeCloseTo(200 / 800)
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('falls back to the region average with no on-screen set', () => {
    const { display, view } = setup()
    display.setDensityStats(0, { featureCount: 500, regionWidthBp: 50_000 })
    zoomAndSettle(view, 62.5)

    expect(display.onScreenFeatureIds).toBeUndefined()
    expect(display.labelDensityPerPx).toBe(display.visibleFeatureDensityPerPx)
    expect(display.showLabels).toBe(false)
  })
})

describe('geneGlyphMode auto collapse', () => {
  function setup() {
    const env = createTestEnvironment()
    const { display, view } = env.createDisplay()
    env.mockRpcCall.mockReturnValue(new Promise(() => {}))
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 200_000, refName: 'ctgA' },
    ])
    return { display, view }
  }

  it('switches to longestCoding when zoomed out past 100 bp/px', () => {
    const { display, view } = setup()
    expect(display.geneGlyphMode).toBe('auto')

    zoomAndSettle(view, 200)
    expect(view.bpPerPx).toBeGreaterThan(100)
    expect(display.effectiveGeneGlyphMode).toBe('longestCoding')

    zoomAndSettle(view, 50)
    expect(view.bpPerPx).toBeLessThan(100)
    expect(display.effectiveGeneGlyphMode).toBe('all')
  })

  it('respects an explicit mode regardless of zoom', () => {
    const { display, view } = setup()
    display.setGeneGlyphMode('all')
    zoomAndSettle(view, 200)
    expect(display.effectiveGeneGlyphMode).toBe('all')
  })
})

describe('region identity is stored with the data it describes', () => {
  it('reports the per-region key off the stored payload', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const regionA = {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 100,
      reversed: false,
    }
    const regionB = {
      assemblyName: 'volvox',
      refName: 'ctgB',
      start: 0,
      end: 100,
      reversed: true,
    }
    display.setRpcData(0, makeFeatureData(), regionA)
    display.setRpcData(1, makeFeatureData(), regionB)

    expect(
      [...display.rpcDataMap.entries()].map(([idx, d]) => [idx, d.regionKey]),
    ).toEqual([
      [0, 'volvox:ctgA'],
      [1, 'volvox:ctgB'],
    ])
    expect([...display.reversedRegions]).toEqual([1])
  })
})

test('the worker payload is exactly the slots DisplayConfig declares', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  expect(Object.keys(display.rpcProps().displayConfig).sort()).toEqual([
    'canonicalTranscriptField',
    'canonicalTranscriptTags',
    'color',
    'connectorColor',
    'containerTypes',
    'displayDirectionalChevrons',
    'featureHeight',
    'hideSourceFeatures',
    'impliedUTRs',
    'jexlFilters',
    'labels',
    'mouseover',
    'outlineColor',
    'subParts',
    'subfeatureLabels',
    'transcriptTypes',
    'utrColor',
  ])
})

describe('SettingsInvalidate keys on the payload, not the reads', () => {
  async function loadedDisplay() {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData())
    const { display, view } = createDisplay()
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    return { display, view, mockRpcCall }
  }

  it.each([
    ['showLabels', 'none'],
    ['height', 600],
    ['heightMode', 'grow'],
    ['growMaxHeight', 900],
    ['maxLabelFeatureDensity', 0.05],
    ['maxDescriptionFeatureDensity', 0.01],
    ['legend', [{ label: 'SINE', color: '#e41a1c' }]],
  ])('a main-thread-only %s change does not refetch', async (slot, value) => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot(slot, value)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
    expect(display.loadedRegions.size).toBe(1)
  })

  it('a compact displayMode does not refetch', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('displayMode', 'compact')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('a below subfeature label still refetches', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('subfeatureLabels', 'below')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('a lowered density budget re-banners from stored stats without a refetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeFeatureData({ featureCount: 100 }))
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 500_000, refName: 'ctgA' },
    ])
    view.zoomTo(1000)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })
    expect(display.maxFeatureDensity).not.toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
    const callsBefore = mockRpcCall.mock.calls.length

    setConf(display, 'maxFeatureScreenDensity', 1e-6)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(display.regionTooLarge).toBe(true)
    expect(display.loadedRegions.size).toBe(1)
    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('a worker-visible change still refetches', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    const callsBefore = mockRpcCall.mock.calls.length

    display.setShowOnlyGenes(true)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(mockRpcCall.mock.calls.at(-1)![2]).toMatchObject({
      showOnlyGenes: true,
    })
  })

  it('collapsed displayMode refetches, because it forces subfeatureLabels off', async () => {
    const { display, mockRpcCall } = await loadedDisplay()
    // subfeatureLabels resolves to 'none' by default, where the collapsed
    // substitution is a no-op.
    display.configuration.setSlot('subfeatureLabels', 'below')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()
    const callsBefore = mockRpcCall.mock.calls.length

    display.configuration.setSlot('displayMode', 'collapsed')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

describe('byte estimate anchoring across an in-flight zoom', () => {
  it('keeps the span the fetch was issued at, not the span at reply time', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])
    view.zoomTo(2000)

    let release: (v: unknown) => void = () => {}
    mockRpcCall.mockImplementation(
      () =>
        new Promise(resolve => {
          release = resolve
        }),
    )

    const issuedSpanBp = display.gateViewport!.spanBp
    jest.advanceTimersByTime(800)
    await waitFor(() => {
      expect(display.isLoading).toBe(true)
    })

    view.zoomTo(500)
    expect(view.visibleBp).toBeLessThan(issuedSpanBp / 2)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    release({ ...makeFeatureData(), bytes: 4_000_000 })
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.byteEstimate?.bytes).toBe(4_000_000)
    })
    expect(display.byteEstimate?.measuredSpanBp).toBe(issuedSpanBp)
    expect(display.estimatedFetchBytes).toBe(4_000_000)
    expect(display.regionTooLarge).toBe(false)
    expect(display.zoomCanReleaseGate).toBe(true)
  })
})
