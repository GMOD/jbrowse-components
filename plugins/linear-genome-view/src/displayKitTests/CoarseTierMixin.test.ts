import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import CoarseTierMixin from '@jbrowse/display-kit/CoarseTierMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { types } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { stateModelFactory as linearGenomeViewStateModelFactory } from '../LinearGenomeView/index.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type {
  CoarseTierRead,
  CoarseTierResult,
} from '@jbrowse/display-kit/coarseTier'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { Instance } from '@jbrowse/mobx-state-tree'

// The mixin's own tests, on the smallest display that composes it: a detail
// fetch that stores a tag per region, and a coarse read that stores a tag per
// region beside it. What is pinned is the mechanism the two real composers
// share — the swap, the suspended detail fetch, the gated variant, and the two
// tiers holding their own spans — not either display's drawing.

const DISPLAY_NAME = 'CoarseTierTestDisplay'

function makeConfigSchema() {
  return ConfigurationSchema(
    DISPLAY_NAME,
    {},
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

interface Control {
  detailCalls: IndexedRegion[][]
  coarseCalls: CoarseTierRead[]
  coarseBytes: number | undefined
  detailBytes: number | undefined
  gated: boolean
  threshold: number
}

type CoarsePayload = { tag: string }

function makeStateModel(
  control: Control,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      DISPLAY_NAME,
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      CoarseTierMixin<CoarsePayload>(),
      types.model({
        type: types.literal(DISPLAY_NAME),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get gateEnabled() {
        return true
      },
      get coarseAdapterSlot() {
        return 'coarseAdapter'
      },
      get coarseTierGated() {
        return control.gated
      },
      get coarseTierPastThreshold() {
        const view = self.host
        return view.initialized && view.visibleBp >= control.threshold
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: IndexedRegion[]) {
        control.detailCalls.push(needed)
        const byteLimit = self.resolvedByteLimit()
        return fetchEachRegion(self, needed, {
          call: (): Promise<
            { tag: string; bytes?: number } | RegionTooLargeResult
          > => {
            const bytes = control.detailBytes
            return Promise.resolve(
              byteLimit !== undefined &&
                bytes !== undefined &&
                bytes > byteLimit
                ? { regionTooLarge: true as const, bytes }
                : { tag: 'detail', bytes },
            )
          },
          onResult: (_idx, result) => result.tag,
        })
      },
      fetchCoarseTier(
        read: CoarseTierRead,
        _ctx: FetchContext,
      ): Promise<CoarseTierResult<CoarsePayload>> {
        control.coarseCalls.push(read)
        const bytes = control.coarseBytes
        const byteLimit = self.resolvedByteLimit()
        return Promise.resolve(
          byteLimit !== undefined && bytes !== undefined && bytes > byteLimit
            ? { regionTooLarge: true as const, bytes }
            : {
                entries: read.regions.map(({ displayedRegionIndex }) => ({
                  displayedRegionIndex,
                  payload: { tag: 'coarse' },
                })),
                bytes,
              },
        )
      },
    }))
}

type TestDisplay = Instance<ReturnType<typeof makeStateModel>>

function setup({
  withSource = true,
  gated = false,
  threshold = 20_000,
}: { withSource?: boolean; gated?: boolean; threshold?: number } = {}) {
  const control: Control = {
    detailCalls: [],
    coarseCalls: [],
    coarseBytes: undefined,
    detailBytes: undefined,
    gated,
    threshold,
  }
  const env = createDisplayTestEnvironment<TestDisplay>({
    trackType: 'FeatureTrack',
    displayName: DISPLAY_NAME,
    configSchema: makeConfigSchema,
    stateModel: (_pm, schema) => makeStateModel(control, schema),
    viewModel: linearGenomeViewStateModelFactory,
    adapter: {
      name: 'CoarseTierTestAdapter',
      slots: { coarseAdapter: { type: 'frozen', defaultValue: null } },
      config: {
        type: 'CoarseTierTestAdapter',
        coarseAdapter: withSource ? { type: 'BigWigAdapter' } : null,
      },
    },
    assemblyEnd: 10_000_000,
    displayConfig: {},
    rpcCall: () => [],
  })
  const { display, view } = env.createDisplay()
  return { display, view, control }
}

async function settle(display: TestDisplay) {
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.isLoading).toBe(false)
    expect(display.coarseTierLoading).toBe(false)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('the swap', () => {
  it('stands in past the threshold and suspends the detail fetch', async () => {
    const { display, view, control } = setup()
    view.zoomTo(1)
    await settle(display)
    expect(display.coarseTierActive).toBe(false)
    expect(display.fetchSuspended).toBe(false)
    expect(control.detailCalls).toHaveLength(1)
    expect(control.coarseCalls).toHaveLength(0)

    view.zoomTo(100)
    await settle(display)
    expect(display.coarseTierActive).toBe(true)
    expect(display.fetchSuspended).toBe(true)
    expect(control.coarseCalls).toHaveLength(1)
    expect(control.detailCalls).toHaveLength(1)
    expect(display.coarseTier.get(0)).toEqual({ tag: 'coarse' })
  })

  it('never stands in without a source', async () => {
    const { display, view, control } = setup({ withSource: false })
    view.zoomTo(100)
    await settle(display)
    expect(display.hasCoarseSource).toBe(false)
    expect(display.coarseTierActive).toBe(false)
    expect(control.coarseCalls).toHaveLength(0)
    expect(control.detailCalls).toHaveLength(1)
  })

  it('is loading until the read lands and the export waits with it', () => {
    const { display, view } = setup()
    view.zoomTo(100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.displayPhase).toBe('loading')
    expect(display.svgReady).toBe(false)

    display.setCoarseTier(
      [{ displayedRegionIndex: 0, payload: { tag: 't' } }],
      {
        regions: [],
        key: 'k',
      },
    )
    expect(display.displayPhase).toBe('ready')
    expect(display.svgReady).toBe(true)
  })

  it('clears the read on chromosome navigation', () => {
    const { display, view } = setup()
    view.zoomTo(100)
    display.setCoarseTier(
      [{ displayedRegionIndex: 0, payload: { tag: 't' } }],
      {
        regions: [],
        key: 'k',
      },
    )
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.coarseTierRead).toBeUndefined()
    expect(display.coarseTier.size).toBe(0)
  })
})

// The two tiers hold their own spans. A detail fetch zoomed in stamps
// `loadedRegions` with its narrow buffered span; the coarse read keeps the wide
// span it was issued over. Zooming back out then re-reads nothing: the held
// read still covers the viewport, whatever the detail stamp says.
describe('each tier holds its own span', () => {
  it('reuses a coarse read across a narrow detail fetch', async () => {
    const { display, view, control } = setup()
    view.zoomTo(100)
    await settle(display)
    expect(control.coarseCalls).toHaveLength(1)
    const wide = display.coarseTierRead!.regions[0]!.region

    view.zoomTo(1)
    await settle(display)
    expect(control.detailCalls).toHaveLength(1)
    const narrow = display.loadedRegions.get(0)!
    expect(narrow.end - narrow.start).toBeLessThan(wide.end - wide.start)
    expect(display.coarseTierRead!.regions[0]!.region).toBe(wide)

    view.zoomTo(100)
    await settle(display)
    expect(control.coarseCalls).toHaveLength(1)
    expect(display.displayPhase).toBe('ready')
  })

  it('re-reads once the viewport leaves the held read', async () => {
    const { display, view, control } = setup()
    view.zoomTo(100)
    await settle(display)
    expect(control.coarseCalls).toHaveLength(1)

    view.zoomTo(400)
    await settle(display)
    expect(control.coarseCalls).toHaveLength(2)
    expect(control.coarseCalls[1]!.regions[0]!.region.end).toBeGreaterThan(
      control.coarseCalls[0]!.regions[0]!.region.end,
    )
  })

  it('leaves the detail stamp where the coarse read landed', async () => {
    const { display, view } = setup()
    view.zoomTo(1)
    await settle(display)
    const stamped = display.loadedRegions.get(0)!

    view.zoomTo(100)
    await settle(display)
    expect(display.loadedRegions.get(0)).toBe(stamped)
    expect(display.regionPayloads.get(0)).toBe('detail')
  })
})

// A gated coarse read is the gate's measurement pass while the tier is up: the
// gate measures the coarse adapter, a refusal is the banner, and the detail
// fetch has nothing to re-measure so it stands down outright.
describe('a gated coarse tier', () => {
  it('measures the coarse adapter and commits its bytes', async () => {
    const { display, view, control } = setup({ gated: true })
    control.coarseBytes = 1000
    view.zoomTo(100)
    await settle(display)
    expect(display.byteGateAdapterPath).toEqual(['adapter', 'coarseAdapter'])
    expect(display.byteEstimate?.bytes).toBe(1000)
    expect(display.regionTooLarge).toBe(false)
    expect(display.coarseTier.size).toBe(1)
  })

  it('raises the banner on a refused read and keeps the detail fetch down', async () => {
    const { display, view, control } = setup({ gated: true })
    control.coarseBytes = 1e9
    view.zoomTo(100)
    await settle(display)
    expect(display.regionTooLarge).toBe(true)
    expect(display.displayPhase).toBe('tooLarge')
    expect(display.drawsWhenTooLarge).toBe(false)
    expect(display.fetchSuspended).toBe(true)
    expect(display.coarseTier.size).toBe(0)
    expect(control.detailCalls).toHaveLength(0)
  })

  it('swaps by threshold alone, so a refused detail fetch keeps the banner', async () => {
    const { display, view, control } = setup({ gated: true })
    control.detailBytes = 1e9
    view.zoomTo(1)
    await settle(display)
    expect(display.regionTooLarge).toBe(true)
    expect(display.coarseTierActive).toBe(false)
    expect(display.byteGateAdapterPath).toEqual(['adapter'])
    expect(display.displayPhase).toBe('tooLarge')
  })
})

describe('an ungated coarse tier', () => {
  it('swaps on the gate refusing the detail fetch and keeps its re-measure', async () => {
    const { display, view, control } = setup({ threshold: Infinity })
    control.detailBytes = 1e9
    view.zoomTo(100)
    await settle(display)
    expect(display.regionTooLarge).toBe(true)
    expect(display.coarseTierActive).toBe(true)
    expect(display.fetchSuspended).toBe(false)
    expect(display.byteGateAdapterPath).toEqual(['adapter'])
    expect(display.drawsWhenTooLarge).toBe(true)
    expect(display.displayPhase).toBe('ready')
    expect(control.coarseCalls).toHaveLength(1)
  })

  it('commits no bytes off its read, so the detail measurement stays owed', async () => {
    const { display, view, control } = setup({ threshold: Infinity })
    control.detailBytes = 1e9
    control.coarseBytes = 10
    view.zoomTo(100)
    await settle(display)
    expect(display.byteEstimate?.bytes).toBe(1e9)
  })
})
