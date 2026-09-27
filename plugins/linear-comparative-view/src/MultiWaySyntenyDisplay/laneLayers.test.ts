import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import {
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
import { createDisplay } from './testEnv.ts'

import type { HeldLaneLayer } from './laneLayers.ts'
import type { RowFrame } from './layoutMultiWay.ts'
import type { LaneMap } from './multiwayRenderTypes.ts'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

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
  display.setLaneLayerData(
    new Map([
      ['a\u00000\u00000', kept],
      ['a\u00000\u00001', held(0, [90])],
    ]),
    undefined,
    new Set(['a\u00000\u00000', 'a\u00000\u00001']),
  )
  display.setLaneLayerData(new Map(), undefined, new Set(['a\u00000\u00000']))
  expect([...display.laneLayerData!.keys()]).toEqual(['a\u00000\u00000'])
  expect(display.laneLayerData!.get('a\u00000\u00000')).toBe(kept)
})
