import {
  densityBandLayer,
  densityBandRegion,
  drawDensityBand,
} from './densityBand.ts'

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
    exact: true,
  }
}

// The packed layout `drawCoverageBins` reads, un-packed: absolute bp and the
// fraction of the region peak. Two u32-sized fields per record.
function unpack(buffer: ArrayBuffer) {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  return Array.from({ length: u32.length / 2 }, (_, i) => ({
    position: u32[i * 2]!,
    relDepth: f32[i * 2 + 1]!,
  }))
}

describe('densityBandRegion', () => {
  it('bins the source intervals over their own extent, one bin per screen pixel', () => {
    const region = densityBandRegion(
      density([
        { start: 100, end: 110, score: 5 },
        { start: 110, end: 120, score: 15 },
      ]),
      10,
    )!
    expect(region.binSize).toBe(10)
    expect(region.maxDepth).toBe(15)
    const bins = unpack(region.buffer)
    expect(bins.map(b => b.position)).toEqual([100, 110])
    expect(bins[0]!.relDepth).toBeCloseTo(5 / 15)
    expect(bins[1]!.relDepth).toBe(1)
  })

  // The whole reason the extent comes off the source rather than off the
  // visible region: at wide zoom the bins are pixels, so the record count
  // tracks the screen and not the span.
  it('follows bp/px rather than the span', () => {
    const source = density([{ start: 0, end: 4000, score: 40 }])
    expect(densityBandRegion(source, 1000)!.binSize).toBe(1000)
    expect(unpack(densityBandRegion(source, 1000)!.buffer)).toHaveLength(4)
    expect(unpack(densityBandRegion(source, 4000)!.buffer)).toHaveLength(1)
  })

  it('has nothing to draw for an empty or all-zero source', () => {
    expect(densityBandRegion(density([]), 10)).toBeUndefined()
    expect(
      densityBandRegion(density([{ start: 0, end: 100, score: 0 }]), 10),
    ).toBeUndefined()
  })
})

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
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { fills, ctx: ctx as unknown as Ctx2D }
}

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
      color: 'grey',
    })

    expect(fills).toHaveLength(2)
    expect(fills.map(f => f.fillStyle)).toEqual(['grey', 'grey'])
    // half height and full height, both bottom-anchored
    expect(fills[0]!.y + fills[0]!.h).toBeCloseTo(fills[1]!.y + fills[1]!.h)
    expect(fills[0]!.h / fills[1]!.h).toBeCloseTo(0.5, 1)
  })

  it('draws nothing when no region holds a depth', () => {
    const { ctx, fills } = recordingCtx()
    drawDensityBand(
      ctx,
      [BLOCK],
      { regions: new Map(), maxDepth: 0 },
      {
        canvasWidth: 100,
        bandHeight: 100,
        color: 'grey',
      },
    )
    expect(fills).toEqual([])
  })
})
