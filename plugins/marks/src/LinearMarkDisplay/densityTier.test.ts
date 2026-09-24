import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  createDisplayTestEnvironment,
  stageByteEstimate,
} from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'
import { autorun } from 'mobx'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 8_000_000,
  assemblyName: 'volvox',
}

const SIDECAR = {
  type: 'BigWigAdapter',
  bigWigLocation: { uri: 'density.bw', locationType: 'UriLocation' },
}

const DENSITY_MARKS = [
  { mark: 'bar', encoding: { y: 'score' } },
  {
    mark: 'bar',
    source: 'density',
    encoding: { y: 'count', color: 'red' },
    minBpPerPx: 100,
  },
]

function createTestEnvironment(marks: unknown[], densityAdapter?: unknown) {
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: {
      name: 'BedAdapter',
      slots: { densityAdapter: { type: 'frozen', defaultValue: null } },
      config: { type: 'BedAdapter', densityAdapter },
    },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: { marks },
    regions: [REGION],
    assemblyRegions: [REGION],
    onViewReady: view => {
      view.showAllRegions()
    },
  })
}

function bins() {
  return {
    starts: Uint32Array.from([0, 1000, 2000]),
    ends: Uint32Array.from([1000, 2000, 3000]),
    scores: Float32Array.from([4, 17, 9]),
  }
}

function refuse(
  display: LinearMarkDisplayModel,
  view: { zoomTo: (n: number) => void },
) {
  view.zoomTo(2000)
  stageByteEstimate(display, 50_000_000)
}

test('a density mark draws the sidecar in the refused fetch place', () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS, SIDECAR)
  const { display, view } = createDisplay()
  refuse(display, view)
  expect(display.regionTooLarge).toBe(true)
  expect(display.densityMarkIndex).toBe(1)
  display.setCoarseTier([{ displayedRegionIndex: 0, payload: bins() }], {
    regions: [],
    key: '',
  })
  expect(display.coarseTierStandsIn).toBe(true)

  const { layers } = display.rpcDataMap.get(0)!
  expect(layers[0]!.count).toBe(0)
  expect([...layers[1]!.y!]).toEqual([4, 17, 9])
  expect([...layers[1]!.x]).toEqual([0, 1000, 2000])
  expect(layers[1]!.color![0]).toBe(cssColorToABGR('red'))
  // the sidecar's levels are the axis, through the same y scale the features
  // draw against
  expect(display.domain).toEqual([0, 18])
  // and the hover reads the bin off the same index the features use
  expect([...layers[1]!.flatbush!.search(900, -1, 1100, 100)].sort()).toEqual([
    0, 1,
  ])
})

test('a point density mark draws the sidecar too, its layer carrying the lanes a point reads', () => {
  const { createDisplay } = createTestEnvironment(
    [
      { mark: 'bar', encoding: { y: 'score' } },
      { mark: 'point', source: 'density', encoding: { y: 'count' } },
    ],
    SIDECAR,
  )
  const { display, view } = createDisplay()
  refuse(display, view)
  display.setCoarseTier([{ displayedRegionIndex: 0, payload: bins() }], {
    regions: [],
    key: '',
  })
  expect(display.coarseTierStandsIn).toBe(true)
  const block = display.renderBlocks[0]!
  const region = display.rpcDataMap.get(block.displayedRegionIndex)!
  expect(
    display.markList[1]!.ink!(region, block, display.renderState, 1),
  ).toBeDefined()
})

test('a zoom that keeps the density mark rebuilds no payload', () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS, SIDECAR)
  const { display, view } = createDisplay()
  refuse(display, view)
  display.setCoarseTier([{ displayedRegionIndex: 0, payload: bins() }], {
    regions: [],
    key: '',
  })
  const payloads = new Set<unknown>()
  const dispose = autorun(() => {
    payloads.add(display.rpcDataMap.get(0))
  })
  view.zoomTo(2500)
  view.zoomTo(3000)
  dispose()
  expect(view.bpPerPx).toBe(3000)
  expect(payloads.size).toBe(1)
  expect(payloads.has(undefined)).toBe(false)
})

test('the banner stands where no mark declares the sidecar', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    SIDECAR,
  )
  const { display, view } = createDisplay()
  refuse(display, view)
  expect(display.regionTooLarge).toBe(true)
  expect(display.coarseTierMode).toBe('never')
  expect(display.coarseTierStandsIn).toBe(false)
  expect(display.densityStandInNotice).toBeUndefined()
})

test('a span declaring the sidecar, which draws no bins, keeps the banner', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'span', source: 'density' }],
    SIDECAR,
  )
  const { display, view } = createDisplay()
  refuse(display, view)
  expect(display.densityMarkIndex).toBe(-1)
  expect(display.coarseTierMode).toBe('never')
  expect(display.coarseTierStandsIn).toBe(false)
})

test('a bar declaring the sidecar after a span draws it', () => {
  const { createDisplay } = createTestEnvironment(
    [
      { mark: 'span', source: 'density' },
      { mark: 'bar', source: 'density', encoding: { y: 'count' } },
    ],
    SIDECAR,
  )
  const { display, view } = createDisplay()
  refuse(display, view)
  display.setCoarseTier([{ displayedRegionIndex: 0, payload: bins() }], {
    regions: [],
    key: '',
  })
  expect(display.densityMarkIndex).toBe(1)
  const block = display.renderBlocks[0]!
  const region = display.rpcDataMap.get(block.displayedRegionIndex)!
  expect(
    display.markList[1]!.ink!(region, block, display.renderState, 1),
  ).toBeDefined()
})

test('a density mark with no sidecar on the adapter keeps the banner', () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, view } = createDisplay()
  refuse(display, view)
  expect(display.hasCoarseSource).toBe(false)
  expect(display.coarseTierStandsIn).toBe(false)
})

test('past the budget a bin opens nothing, and the notice says what is drawn', () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS, SIDECAR)
  const { display, session, view } = createDisplay()
  refuse(display, view)
  display.setCoarseTier([{ displayedRegionIndex: 0, payload: bins() }], {
    regions: [],
    key: '',
  })
  display.selectFeature({
    markIndex: 1,
    regionIndex: 0,
    instance: 1,
    featureIndex: 1,
    refName: 'ctgA',
    start: 1000,
    end: 2000,
    bp: 1000,
    y: 17,
    color: undefined,
    colorValue: undefined,
    glyph: undefined,
    row: undefined,
    screenX: 0,
    screenY: 0,
  })
  expect(session.openedWidgets).toHaveLength(0)
  expect(display.densityStandInNotice).toContain('density sidecar')
  expect(display.densityStandInNotice).toContain('1 other mark')
})
