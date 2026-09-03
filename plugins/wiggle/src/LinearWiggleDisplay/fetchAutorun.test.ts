import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'
import { getMembers } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { processFeaturesFromArrays } from '../util.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

function makeEmptyWiggleData(): WiggleDataResult {
  return {
    sources: [
      {
        name: 'default',
        featurePositions: new Uint32Array(0),
        featureScores: new Float32Array(0),
        featureMinScores: new Float32Array(0),
        featureMaxScores: new Float32Array(0),
        numFeatures: 0,
        posFeaturePositions: new Uint32Array(0),
        posFeatureScores: new Float32Array(0),
        posNumFeatures: 0,
        negFeaturePositions: new Uint32Array(0),
        negFeatureScores: new Float32Array(0),
        negNumFeatures: 0,
        hasSummaryScores: false,
      },
    ],
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Architecture under test:
//   rpcProps changes → SettingsInvalidate supersedes the fetch → fetch re-runs
//   gpuProps changes → per-region encode autoruns re-fire, re-uploading
//                      the GPU buffer (no RPC roundtrip)
//   renderState-only changes → render autorun re-runs (no upload, no fetch)
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

describe('LinearWiggleDisplay SettingsInvalidate autorun', () => {
  it('refetches when bicolorPivot changes (rpcProps field)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.configuration.setSlot('bicolorPivot', 5)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('refetches when resolution changes (rpcProps field)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setResolution(5)
    jest.advanceTimersByTime(400)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // adr-008: the worker bins scores to the requested bpPerPx, so a zoom that
  // stays spatially inside the fetched region still holds the wrong summary.
  // `viewportWithinLoadedData` is asserted first so the refetch can only be
  // `zoomFetchKey` — coverage would explain it otherwise.
  it('refetches after a zoom that stays inside the loaded region', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display, view } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    view.zoomTo(view.bpPerPx / 2)
    expect(display.viewportWithinLoadedData).toBe(true)
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // gpuProps fields (color, summaryScoreMode, renderingType, ...) re-fire the
  // per-region encode autoruns → re-upload only. The worker output doesn't
  // change, so no refetch should happen.
  it('does NOT refetch when summaryScoreMode changes (gpuProps re-uploads)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setSummaryScoreMode('max')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // posColor is a pure gpuProps field (only used in the per-instance buffer).
  // We use it instead of color because color indirectly feeds effectiveBicolorPivot
  // (an rpcProps field), so changing color *can* legitimately refetch.
  it('does NOT refetch when posColor changes (gpuProps re-uploads)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setPosColor('#abcdef')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  it('does not refetch when an unrelated property is touched', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.toggleCrossHatches() // pure UI toggle — no GPU buffer impact
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // Settings consumed only at draw time (renderState, e.g. scaleType) flow
  // through the GPU render autorun as a uniform — they don't need a refetch
  // and don't need a re-upload either.
  it('does NOT refetch when scaleType changes (handled by render autorun)', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    const callsBefore = mockRpcCall.mock.calls.length
    display.setScaleType('log')
    jest.advanceTimersByTime(800)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsBefore)
  })

  // Guard against the foot-gun in feedback_rpcprops_no_fetch_results: if any
  // rpcProps field is derived from rpcDataMap (or any other fetch result),
  // populating it during fetch will change rpcProps, which SettingsInvalidate
  // watches → invalidateSettings → infinite loop. A direct shape comparison
  // before/after fetch catches that the moment a new field is added wrong.
  it('rpcProps shape is unchanged after a fetch populates rpcDataMap', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    const before = JSON.stringify(display.rpcProps())

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    expect(JSON.stringify(display.rpcProps())).toBe(before)
  })

  // Regression: a region containing zero features (e.g. GWAS at a window with
  // no SNPs) must not strand the loading overlay forever. renderState always
  // resolves (to the EMPTY_PLOT_DOMAIN stub) so renderBlocks runs, clears the
  // canvas, and canvasDrawn can flip once data loads; "still loading" is the
  // render callback's `rpcDataMap.size === 0` first-paint gate, not a nullable
  // renderState. So the state is a stub before and after the fetch — what
  // changes is that a (zero-feature) region entry has loaded.
  it('renderState stays a stub through a zero-feature fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue([makeEmptyWiggleData()])
    const { display } = createDisplay()

    // before the fetch: nothing loaded (the first-paint gate holds), stub state
    expect(display.rpcDataMap.size).toBe(0)
    expect(display.renderState).toBeDefined()

    jest.advanceTimersByTime(400)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // after the zero-feature fetch: a region entry exists so the size gate
    // passes and the stub paints; the score domain stays undefined.
    expect(display.rpcDataMap.size).toBeGreaterThan(0)
    expect(display.domain).toBeUndefined()
    expect(display.renderState).toBeDefined()
  })
})

// Signed data with real summary bands, so whiskers produces its full layer set.
function makeSignedWiggleData(useBicolor: boolean): WiggleDataResult {
  return {
    sources: [
      {
        name: 'default',
        ...processFeaturesFromArrays(
          {
            starts: new Int32Array([0, 10]),
            ends: new Int32Array([10, 20]),
            scores: new Float32Array([5, -5]),
            minScores: new Float32Array([2, -8]),
            maxScores: new Float32Array([9, -1]),
            count: 2,
          },
          0,
          useBicolor,
        ),
      },
    ],
  }
}

// Regression: `useBicolor: false` only reached the 'avg' path, where the worker
// pre-splits into the pos arrays. whiskers — the default summaryScoreMode —
// re-derives the split on the main thread, so a solid green track came back
// green above the pivot and the negColor slot's red below it.
describe('LinearWiggleDisplay solid color', () => {
  // Bands are still tinted by magnitude (lighten/darken), so the assertion is
  // on hue: a green-family color has equal red and blue channels, red does not.
  const isGreenHue = (c: readonly [number, number, number]) =>
    c[0] === c[2] && c[1] > c[0]

  test.each(['whiskers', 'avg', 'min', 'max'])(
    'every layer keeps the single hue in %s mode',
    mode => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      display.setUseBicolor(false)
      display.setColor('green')
      display.setSummaryScoreMode(mode)

      const layers = buildSourceRenderData(
        makeSignedWiggleData(false),
        display.gpuProps(),
      )

      expect(layers.length).toBeGreaterThan(0)
      for (const layer of layers) {
        expect(isGreenHue(layer.color)).toBe(true)
        for (const packed of layer.colorsAbgr ?? []) {
          expect(abgrRed(packed)).toBe(abgrBlue(packed))
          expect(abgrGreen(packed)).toBeGreaterThan(abgrRed(packed))
        }
      }
    },
  )

  // Density is the case the hue assertion above cannot make. It ignores the
  // `color` slot entirely and always draws from posColor (the `color` config
  // doc says so, and `scoreRamp` returns undefined with bicolor off, so the
  // legend describes no negative side). The claim here is therefore only that
  // one color comes out, not which. min/max re-derive the pos/neg split on the
  // main thread from bicolorPivot, which is where a second color got in.
  test.each(['avg', 'min', 'max'])(
    'density with bicolor off stays one color in %s mode',
    mode => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      display.setUseBicolor(false)
      display.setColor('green')
      display.setRenderingType('density')
      display.setSummaryScoreMode(mode)

      const layers = buildSourceRenderData(
        makeSignedWiggleData(false),
        display.gpuProps(),
      )

      expect(layers.length).toBeGreaterThan(0)
      const colors = new Set(layers.map(l => JSON.stringify(l.color)))
      expect(colors.size).toBe(1)
    },
  )

  test('bicolor still splits the whisker bands by sign', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSummaryScoreMode('whiskers')

    const layers = buildSourceRenderData(
      makeSignedWiggleData(true),
      display.gpuProps(),
    )
    const colors = new Set(layers.map(l => JSON.stringify(l.color)))
    expect(colors.size).toBeGreaterThan(1)
  })
})
