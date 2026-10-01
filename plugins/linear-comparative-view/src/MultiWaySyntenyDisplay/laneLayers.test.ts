import { createElement } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { bandInk } from '@jbrowse/synteny-core'
import { render } from '@testing-library/react'
import { when } from 'mobx'

import LaneLayerTitles from './components/LaneLayerTitles.tsx'
import {
  LANE_TEMPLATE_MAX_BP,
  barCellOf,
  barChannelsOf,
  laneLayerBlockSpan,
  laneLayerBpPerPx,
  laneLayerDomains,
  laneLayerOrigin,
  laneLayersPx,
  layerBandTops,
} from './laneLayers.ts'
import { rowFrameX } from './layoutMultiWay.ts'
import { drawnPx } from './multiwayRenderTypes.ts'
import { createDisplay, createDisplayWithSession } from './testEnv.ts'

import type { HeldLaneLayer, LaneLayerFetchSpec } from './laneLayers.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { LaneMap } from './multiwayRenderTypes.ts'
import type {
  EncodedChannels,
  LayerRequest,
} from '@jbrowse/core/util/markEncoding'

const WIDTH = 1000

function frameOf(flipped: boolean): RowFrame {
  return {
    refName: 'chr11',
    min: 69_000_000,
    max: 69_300_000,
    flipped,
    fitMin: 69_000_000,
    fitMax: 69_300_000,
    alsoOn: [],
    alsoOnMore: 0,
  }
}

describe('a lane layer block', () => {
  const start = 68_900_000
  const end = 69_500_000
  const maps: [string, LaneMap][] = [
    ['settled', { scale: 1, offset: 0 }],
    ['moving', { scale: 1.7, offset: -240 }],
    ['mirroring', { scale: -0.4, offset: 700 }],
  ]
  for (const flipped of [false, true]) {
    for (const [name, map] of maps) {
      test(`puts a bp where the lane draws it: ${flipped ? 'flipped' : 'forward'}, ${name}, panned`, () => {
        const frame = frameOf(flipped)
        const drag = -310
        const block = laneLayerBlockSpan(
          [rowFrameX(frame, start, WIDTH), rowFrameX(frame, end, WIDTH)],
          map,
          drag,
        )
        expect(block.screenStartPx).toBeLessThan(block.screenEndPx)
        for (const bp of [start, 69_000_000, 69_123_456, end]) {
          expect(makeBpMapper({ ...block, start, end })(bp)).toBeCloseTo(
            drawnPx(map, rowFrameX(frame, bp, WIDTH)) + drag,
            6,
          )
        }
      })
    }
  }

  test('covers the canvas after a pan, since the fetched region reaches past the frame', () => {
    const frame = frameOf(false)
    const block = laneLayerBlockSpan(
      [rowFrameX(frame, start, WIDTH), rowFrameX(frame, end, WIDTH)],
      { scale: 1, offset: 0 },
      200,
    )
    expect(block.screenStartPx).toBeLessThanOrEqual(0)
    expect(block.screenEndPx).toBeGreaterThanOrEqual(WIDTH)
  })
})

function held(layer: number, ...values: number[][]): HeldLaneLayer {
  return {
    key: '',
    assemblyName: 'a',
    layer,
    region: { assemblyName: 'a', refName: 'chr1', start: 0, end: 1 },
    channels: values.map(
      v =>
        ({
          count: v.length,
          y: new Float32Array(v),
        }) as EncodedChannels,
    ),
  }
}

describe('the shared domain', () => {
  test('is the union over every lane, per layer', () => {
    expect(
      laneLayerDomains(
        [held(0, [40, 45]), held(0, [35, 60]), held(1, [2, 3])],
        2,
      ),
    ).toEqual([
      [35, 60],
      [2, 3],
    ])
  })

  test("clips one lane's outliers rather than letting them set every lane's scale", () => {
    const typical = Array.from({ length: 400 }, (_, i) => 40 + (i % 21))
    expect(laneLayerDomains([held(0, typical), held(0, [7, 89])], 1)).toEqual([
      [40, 60],
    ])
  })

  test('is nothing for a layer nothing has loaded, and widens a single value', () => {
    expect(laneLayerDomains([held(0, [5, 5])], 2)).toEqual([[4, 6], undefined])
  })
})

describe('the bars a payload draws', () => {
  test('squish a value past the shared domain to its end, so no bar wears the clip strip', () => {
    const [channels] = held(0, [20, 45, 90]).channels
    expect([...barChannelsOf(channels!, [30, 60])!.y]).toEqual([30, 45, 60])
    expect(channels!.y).toEqual(new Float32Array([20, 45, 90]))
  })

  test('keep the payload own values where the domain holds them all', () => {
    const [channels] = held(0, [40, 45]).channels
    expect(barChannelsOf(channels!, [30, 60])!.y).toBe(channels!.y)
  })

  test('are one cell per payload and domain, so a settle uploads nothing', () => {
    const [channels] = held(0, [40, 45]).channels
    const cell = barCellOf(channels!, [30, 60])
    expect(barCellOf(channels!, [30, 60])).toBe(cell)
    expect(barCellOf(channels!, [30, 50])).not.toBe(cell)
  })

  test('a bar grows from zero where the domain holds it, else from the nearer end', () => {
    expect(laneLayerOrigin([-2, 5])).toBe(0)
    expect(laneLayerOrigin([35, 60])).toBe(35)
    expect(laneLayerOrigin([-60, -35])).toBe(-35)
  })
})

test('a lane reads its layer at a power of two, so a resize inside one refetches nothing', () => {
  expect(laneLayerBpPerPx(190)).toBe(256)
  expect(laneLayerBpPerPx(200)).toBe(256)
  expect(laneLayerBpPerPx(170)).toBe(128)
  expect(laneLayerBpPerPx(0.3)).toBe(0.25)
})

test('bands stack from the lane layer top, a gap apart', () => {
  expect(layerBandTops(100, [24, 10])).toEqual([100, 126])
  expect(laneLayersPx([24, 10])).toBe(38)
})

test('a commit drops held payloads its specs no longer name, so a region the view left stops drawing', () => {
  const display = createDisplay()
  const kept = held(0, [40])
  const anchor = display.anchorAssemblyName
  const spec = (lane: string) => ({ lane, key: 'k', assemblyName: 'a' })
  display.setLaneLayerData(
    new Map([
      ['a\u00000\u00000', kept],
      ['a\u00000\u00001', held(0, [90])],
    ]),
    [spec('a\u00000\u00000'), spec('a\u00000\u00001')],
    anchor,
  )
  display.setLaneLayerData(new Map(), [spec('a\u00000\u00000')], anchor)
  expect([...display.laneLayerData.held!.keys()]).toEqual(['a\u00000\u00000'])
  expect(display.laneLayerData.held!.get('a\u00000\u00000')).toBe(kept)
})

describe('a template layer', () => {
  async function templateDisplay(
    adapter: Record<string, unknown>,
    {
      mate = 'volvox_random',
      tracks = [],
      ...opts
    }: Parameters<typeof createDisplayWithSession>[0] & {
      mate?: string
      tracks?: string[]
    } = {},
  ) {
    const { display } = createDisplayWithSession({
      trackAssemblyNames: ['volvox', mate],
      rpc: async name =>
        name === 'CoreGetEncodedLayers' ? { layers: [] } : [],
      ...opts,
    })
    setConf(display, 'laneLayers', [
      {
        name: 'GC',
        adapter,
        tracks,
        marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      },
    ])
    await when(() => display.features !== undefined, { timeout: 5000 })
    display.setFeatures(
      [0, 1, 2, 3].map(
        i =>
          new SimpleFeature({
            uniqueId: `g${i}`,
            name: `g${i}`,
            refName: 'ctgA',
            start: 50 + 100 * i,
            end: 110 + 100 * i,
            strand: 1,
            mate: {
              assemblyName: mate,
              refName: 'ctgA',
              start: 1600 + 100 * i,
              end: 1660 + 100 * i,
            },
          }),
      ),
    )
    await when(() => display.rowFrames.get(mate) !== undefined, {
      timeout: 5000,
    })
    return display
  }

  const reads = (display: { laneLayersFetchSpecs: LaneLayerFetchSpec[] }) =>
    display.laneLayersFetchSpecs.map(spec => ({
      lane: spec.assemblyName,
      type: spec.adapterConfig.type,
      regionAssembly: spec.region.assemblyName,
    }))

  const GC = { type: 'TestSequenceScoreAdapter' }

  test('every held lane reads it through its own genome', async () => {
    const display = await templateDisplay(GC)
    expect(reads(display)).toEqual([
      {
        lane: 'volvox',
        type: 'TestSequenceScoreAdapter',
        regionAssembly: 'volvox',
      },
      {
        lane: 'volvox_random',
        type: 'TestSequenceScoreAdapter',
        regionAssembly: 'volvox_random',
      },
    ])
  })

  test('a lane its `tracks` names reads that track instead', async () => {
    const display = await templateDisplay(GC, {
      geneTracks: [
        { trackId: 'volvox_genes', assemblyNames: ['volvox'] },
        { trackId: 'random_scores', assemblyNames: ['volvox_random'] },
      ],
      tracks: ['random_scores'],
    })
    expect(reads(display).map(read => [read.lane, read.type])).toEqual([
      ['volvox', 'TestSequenceScoreAdapter'],
      ['volvox_random', 'Gff3TabixAdapter'],
    ])
  })

  test('an adapter that computes from no sequence is read by no lane, since each would read the one file at its own coordinates', async () => {
    const display = await templateDisplay({ type: 'Gff3TabixAdapter' })
    expect(reads(display)).toEqual([])
  })

  test('a lane whose genome the session lacks reads it once its temporary assembly is held', async () => {
    const display = await templateDisplay(GC, { mate: 'hg002' })
    expect(reads(display).map(read => read.lane)).toEqual(['volvox'])
    display.endDescribingLanes([], {
      hg002: { assembly: { name: 'hg002' } },
    })
    await when(() => display.holdsAssembly('hg002'), { timeout: 5000 })
    expect(reads(display).map(read => read.lane)).toEqual(['volvox', 'hg002'])
  })

  test('a lane wider than the cap is left out, and the title says to zoom in', async () => {
    const display = await templateDisplay(GC)
    expect(reads(display)).toHaveLength(2)
    expect(display.laneLayerTitles[0]!.text).not.toMatch(/zoom in/)
    display.lgv.setDisplayedRegions([
      {
        refName: 'ctgA',
        start: 0,
        end: 2 * LANE_TEMPLATE_MAX_BP,
        assemblyName: 'volvox',
      },
    ])
    display.lgv.showAllRegions()
    expect(reads(display)).toEqual([])
    expect(display.laneLayerTitles[0]!.text).toMatch(/ · zoom in$/)
  })

  // The worker reads no colour a lane layer's mark declares, so the bars take
  // it from the display's stamp, and an edit repaints what is held.
  test("a layer's bars paint its mark's colour, and a recolour refetches nothing", async () => {
    const scores = [1, 2, 3].map(
      i =>
        new SimpleFeature({
          uniqueId: `s${i}`,
          refName: 'ctgA',
          start: 100 * i,
          end: 100 * i + 50,
          score: i,
        }),
    )
    const display = await templateDisplay(GC, {
      rpc: async (name, args) =>
        name === 'CoreGetEncodedLayers'
          ? {
              layers: (args.layers as LayerRequest[]).map(l =>
                encodeFeatures(scores, l.encoding, l.lanes),
              ),
            }
          : [],
    })
    setConf(display.configuration.laneLayers[0]!.marks[0]!, 'encoding', {
      y: 'score',
      color: { value: 'red' },
    })
    await when(() => display.laneLayerCells.cells.size > 0, { timeout: 5000 })
    const barColors = () =>
      [...display.laneLayerCells.cells.values()].map(cell =>
        cell.kind === 'bars' ? cell.data.color : undefined,
      )
    expect(new Set(barColors())).toEqual(new Set([cssColorToABGR('red')]))
    const keys = display.laneLayersFetchSpecs.map(spec => spec.key)

    setConf(display.configuration.laneLayers[0]!.marks[0]!, 'encoding', {
      y: 'score',
      color: { value: 'green' },
    })

    expect(display.laneLayersFetchSpecs.map(spec => spec.key)).toEqual(keys)
    expect(new Set(barColors())).toEqual(new Set([cssColorToABGR('green')]))
  })

  // The band is white in every theme, and a dark theme's palette text is white.
  test('the title is band ink, whatever the theme', async () => {
    const display = await templateDisplay(GC)
    const { getAllByTestId } = render(
      createElement(LaneLayerTitles, { model: display }),
    )
    const [title] = getAllByTestId('multiway-layer-title')
    expect(title!.style.color).toBe(bandInk().text)
  })
})
