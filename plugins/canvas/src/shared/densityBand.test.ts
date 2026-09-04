import {
  densityBandLayer,
  drawDensityBand,
  formatDensity,
} from './densityBand.ts'
import { densityBandReadout, densityValueAt } from './densityBandViews.ts'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function density(
  intervals: { start: number; end: number; score: number }[],
): FeatureDensity {
  return {
    starts: new Uint32Array(intervals.map(i => i.start)),
    ends: new Uint32Array(intervals.map(i => i.end)),
    scores: new Float32Array(intervals.map(i => i.score)),
  }
}

describe('densityBandLayer', () => {
  // Per-region normalization would draw the quiet contig at the same full-band
  // height as the busy one; the peak the bars are measured against is the
  // display's.
  it('reports the peak across every region it holds', () => {
    const layer = densityBandLayer(
      new Map([
        [0, density([{ start: 0, end: 10, score: 2 }])],
        [1, density([{ start: 0, end: 10, score: 20 }])],
      ]),
      10,
    )
    expect(layer.maxDepth).toBe(20)
    expect([...layer.regions.keys()]).toEqual([0, 1])
  })

  it('drops a region whose source is empty', () => {
    const layer = densityBandLayer(
      new Map([
        [0, density([])],
        [1, density([{ start: 0, end: 10, score: 3 }])],
      ]),
      10,
    )
    expect([...layer.regions.keys()]).toEqual([1])
  })
})

// The same stub shape the multi-row draw tests use: `Ctx2D` is a union with a
// class in it, so a structural stand-in cannot satisfy it without the cast.
function recordingCtx() {
  const fills: {
    x: number
    y: number
    w: number
    h: number
    fillStyle: string
  }[] = []
  const texts: string[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: '',
    lineWidth: 0,
    lineJoin: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    strokeText() {},
    fillText(text: string) {
      texts.push(text)
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { fills, texts, ctx: ctx as unknown as Ctx2D }
}

const INK = { text: { secondary: 'grey' }, background: { paper: 'white' } }

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

describe('drawDensityBand', () => {
  it('draws each bin against the display-wide peak, from the band floor up', () => {
    const layer = densityBandLayer(
      new Map([
        [
          0,
          density([
            { start: 0, end: 50, score: 50 },
            { start: 50, end: 100, score: 100 },
          ]),
        ],
      ]),
      50,
    )
    const { ctx, fills } = recordingCtx()

    drawDensityBand(ctx, [BLOCK], layer, {
      canvasWidth: 100,
      bandHeight: 100,
      readout: '',
      palette: INK,
    })

    expect(fills).toHaveLength(2)
    expect(fills.map(f => f.fillStyle)).toEqual(['grey', 'grey'])
    // half height and full height, both bottom-anchored
    expect(fills[0]!.y + fills[0]!.h).toBeCloseTo(fills[1]!.y + fills[1]!.h)
    expect(fills[0]!.h / fills[1]!.h).toBeCloseTo(0.5, 1)
  })

  // Without the readout an empty band is an empty rectangle, which reads as
  // "no features here" rather than "the sidecar answered with nothing"
  it('draws no bars but still its readout when no region holds a depth', () => {
    const { ctx, fills, texts } = recordingCtx()
    drawDensityBand(
      ctx,
      [BLOCK],
      { regions: new Map(), maxDepth: 0 },
      {
        canvasWidth: 100,
        bandHeight: 100,
        readout: 'no density data in view',
        palette: INK,
      },
    )
    expect(fills).toEqual([])
    expect(texts).toEqual(['no density data in view'])
  })
})

describe('the readout', () => {
  const bins = new Map([
    [
      0,
      {
        starts: Uint32Array.from([0, 1000, 2000]),
        ends: Uint32Array.from([1000, 2000, 3000]),
        scores: Float32Array.from([3, 0.5, 120]),
      },
    ],
  ])

  test('reads the bar under the cursor, and nothing off the packed span', () => {
    const { regions } = densityBandLayer(bins, 10)
    expect(densityValueAt(regions, { displayedRegionIndex: 0, bp: 1500 })).toBe(
      0.5,
    )
    expect(densityValueAt(regions, { displayedRegionIndex: 0, bp: 3000 })).toBe(
      undefined,
    )
    expect(densityValueAt(regions, { displayedRegionIndex: 1, bp: 10 })).toBe(
      undefined,
    )
  })

  test('names the peak, and the value while there is a cursor', () => {
    const layer = densityBandLayer(bins, 10)
    expect(densityBandReadout(layer, undefined)).toBe('density peak 120')
    expect(densityBandReadout(layer, { displayedRegionIndex: 0, bp: 10 })).toBe(
      '3.0 at cursor, density peak 120',
    )
  })

  // Both numbers are the resampled bin, so they stay the same quantity where a
  // sidecar hands back rows finer than the screen bin — no zoom level fitting
  // the view is the normal way there. Against the raw intervals the cursor read
  // 120 while the bar it sat on, and the peak, were the mean over the three.
  test('reads the same quantity as the peak when the bin spans many rows', () => {
    const layer = densityBandLayer(bins, 3000)
    expect(layer.maxDepth).toBeCloseTo((3 + 0.5 + 120) / 3)
    expect(
      densityValueAt(layer.regions, { displayedRegionIndex: 0, bp: 2500 }),
    ).toBeCloseTo(layer.maxDepth)
  })

  // A gap inside the packed span is a bar of zero height, so the readout names
  // it rather than falling back to the peak alone — off the span there is no
  // bar to name and it does.
  test('reads a gap inside the span as the zero bar it draws', () => {
    const gapped = new Map([
      [
        0,
        {
          starts: Uint32Array.from([0, 2000]),
          ends: Uint32Array.from([1000, 3000]),
          scores: Float32Array.from([3, 120]),
        },
      ],
    ])
    const layer = densityBandLayer(gapped, 10)
    expect(
      densityValueAt(layer.regions, { displayedRegionIndex: 0, bp: 1500 }),
    ).toBe(0)
    expect(
      densityBandReadout(layer, { displayedRegionIndex: 0, bp: 1500 }),
    ).toBe('0.0 at cursor, density peak 120')
  })

  // The band otherwise draws nothing at all, and an empty track cannot be told
  // from a sidecar over the wrong assembly
  test('says so when the layer holds no depth', () => {
    const layer = densityBandLayer(new Map(), 10)
    expect(densityBandReadout(layer, undefined)).toBe('no density data in view')
  })

  test('formats a mean to what a band can show', () => {
    expect(formatDensity(0.0341)).toBe('0.034')
    expect(formatDensity(Math.PI)).toBe('3.1')
    expect(formatDensity(119.6)).toBe('120')
  })
})
