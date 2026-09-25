import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  abgrToCssRgba,
} from '@jbrowse/core/util/colorBits'
import {
  makeBpMapper,
  spanLeft,
  strokeRectInside,
} from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
import {
  recordingContext,
  sweepMarkAgainstHit,
} from '@jbrowse/render-core/marks/drawAgainstHit'
import {
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

import { MIN_DENSITY_ALPHA } from '../components/sharedRendererConstants.ts'
import {
  rectDrawsOutline,
  rectSpanPx,
} from '../passes/shaders/rect.js.generated.ts'
import { arrowShape, lineShape, rectShape } from './featureGlyphShapes.ts'

import type {
  ArrowChannels,
  FeatureGlyphParams,
  LineChannels,
  RectChannels,
} from './featureGlyphShapes.ts'
import type { MarkContext2D, MarkShape } from '@jbrowse/render-core/marks'

// 200 bp over 100 px: the third rect is a sub-pixel feature that takes the
// snap floor, the second sits on a row the scroll has pushed off the canvas.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 200,
  screenStartPx: 20,
  screenEndPx: 120,
  reversed: false,
}

const frame = { canvasWidth: 140, canvasHeight: 40 }

const rects: RectChannels = {
  startEnd: Uint32Array.from([10, 60, 80, 140, 150, 151, 170, 199]),
  y: Float32Array.from([2, 90, 14.5, 26]),
  height: Float32Array.from([8, 8, 7, 5]),
  color: Uint32Array.from([0xff0000ff, 0xff00ff00, 0xffff0000, 0xff0000ff]),
  densityFade: Uint32Array.from([0, 0, 1, 0]),
  strand: Float32Array.from([1, -1, 1, 0]),
  count: 4,
}

const sliceRect = (c: RectChannels, i: number): RectChannels => ({
  startEnd: c.startEnd.subarray(i * 2, i * 2 + 2),
  y: c.y.subarray(i, i + 1),
  height: c.height.subarray(i, i + 1),
  color: c.color.subarray(i, i + 1),
  densityFade: c.densityFade.subarray(i, i + 1),
  strand: c.strand.subarray(i, i + 1),
  count: 1,
})

describe('rect: the box is the fill, snapped as the painter snaps it', () => {
  test.each([false, true])('reversed %s', reversed => {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: rectShape,
          channels: (c: RectChannels) => c,
          params: () => ({ scrollY: 0, outlineColor: 0 }),
        }),
        rects,
        { ...block, reversed },
        frame,
        { maxDistSq: Number.MIN_VALUE, sliceOne: sliceRect },
      ),
    ).toEqual([])
  })
})

const arrows: ArrowChannels = {
  x: Uint32Array.from([60, 100]),
  y: Float32Array.from([6, 20]),
  height: Float32Array.from([8, 8]),
  widthBp: Uint32Array.from([50, 40]),
  direction: Int8Array.from([1, -1]),
  color: Uint32Array.from([0xff0000ff, 0xff00ff00]),
  count: 2,
}

const sliceArrow = (c: ArrowChannels, i: number): ArrowChannels => ({
  x: c.x.subarray(i, i + 1),
  y: c.y.subarray(i, i + 1),
  height: c.height.subarray(i, i + 1),
  widthBp: c.widthBp.subarray(i, i + 1),
  direction: c.direction.subarray(i, i + 1),
  color: c.color.subarray(i, i + 1),
  count: 1,
})

describe('arrow: the box holds the stem and the head', () => {
  test.each([false, true])('reversed %s', reversed => {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: arrowShape,
          channels: (c: ArrowChannels) => c,
          params: () => ({ scrollY: 0, outlineColor: 0 }),
        }),
        arrows,
        { ...block, reversed },
        frame,
        { maxDistSq: 100, sliceOne: sliceArrow },
      ),
    ).toEqual([])
  })
})

// 180 bp at 2 bp/px is a 90 px intron, wide enough for chevrons.
describe('line: the render state decides whether chevrons draw', () => {
  const lines: LineChannels = {
    startEnd: Uint32Array.from([10, 190]),
    y: Float32Array.from([10]),
    direction: Int8Array.from([1]),
    color: Uint32Array.from([0xff0000ff]),
    count: 1,
  }
  function strokesPainted(hideChevrons: boolean) {
    let strokes = 0
    const ctx = {
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        strokes++
      },
    } as unknown as MarkContext2D
    lineShape.paintBlock(ctx, lines, block, frame, {
      scrollY: 0,
      outlineColor: 0,
      hideChevrons,
    })
    return strokes
  }

  test('a hidden chevron leaves the intron line alone', () => {
    expect(strokesPainted(false)).toBeGreaterThan(1)
    expect(strokesPainted(true)).toBe(1)
  })
})

const GLYPH_Y_SLACK_PX = 8

function rowVisible(
  scrollY: number,
  canvasHeight: number,
  topY: number,
  heightPx: number,
) {
  const y = topY - scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX && y <= canvasHeight + GLYPH_Y_SLACK_PX
  )
}

function makeRectFill(ctx: MarkContext2D) {
  let last: number | undefined
  return (c: number, fade: number | undefined) => {
    const key = fade ? c + 0x1_0000_0000 : c
    if (key !== last) {
      last = key
      const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
      ctx.fillStyle = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    }
  }
}

function paintedRectSpan(
  startBp: number,
  endBp: number,
  toX: (bp: number) => number,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

const retiredRect: Required<
  Pick<MarkShape<RectChannels, FeatureGlyphParams>, 'paintBlock' | 'ink'>
> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, y: ys, height, color, densityFade, count } = channels
    const { scrollY, outlineColor } = params
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const setFill = makeRectFill(ctx)
    const outlineStyle = outlineColor ? abgrToCssRgba(outlineColor) : undefined
    if (outlineStyle !== undefined) {
      ctx.strokeStyle = outlineStyle
      ctx.lineWidth = 1
    }
    for (let i = 0; i < count; i++) {
      if (!rowVisible(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const y = snapBoxTopPx(ys[i]!, height[i]!, scrollY)
      const h = snapBoxHeightPx(height[i]!)
      const [xLeft, w] = paintedRectSpan(
        startEnd[i * 2]!,
        startEnd[i * 2 + 1]!,
        toX,
      )
      setFill(color[i]!, densityFade[i])
      ctx.fillRect(xLeft, y, w, h)
      if (outlineStyle !== undefined && rectDrawsOutline(w, h)) {
        strokeRectInside(ctx, xLeft, y, w, h)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const { startEnd, y: ys, height } = channels
    if (!rowVisible(params.scrollY, frame.canvasHeight, ys[i]!, height[i]!)) {
      return undefined
    }
    const [left, width] = paintedRectSpan(
      startEnd[i * 2]!,
      startEnd[i * 2 + 1]!,
      makeBpMapper(block),
    )
    return {
      left,
      top: snapBoxTopPx(ys[i]!, height[i]!, params.scrollY),
      width,
      height: snapBoxHeightPx(height[i]!),
    }
  },
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function styleRecording() {
  const recording = recordingContext()
  const styles: string[] = []
  for (const key of ['fillStyle', 'strokeStyle', 'lineWidth'] as const) {
    let value: unknown = recording.ctx[key]
    Object.defineProperty(recording.ctx, key, {
      get: () => value,
      set: (v: unknown) => {
        styles.push(`${key} ${String(v)}`)
        value = v
      },
    })
  }
  return { ...recording, styles }
}

const RECT_FRAME = { canvasWidth: 1600, canvasHeight: 406 }
const RECT_COLORS = [0xff3355cc, 0xff22aa44, 0x80cc8811, 0xff884499]
const RECT_HEIGHTS = [10, 6, 7, 5, 2.5, 3, 12.5]

function manyRects(regionStart: number, regionBp: number): RectChannels {
  const rand = rng(regionBp)
  const count = 3000
  const startEnd = new Uint32Array(count * 2)
  const y = new Float32Array(count)
  const height = new Float32Array(count)
  const color = new Uint32Array(count)
  const densityFade = new Uint32Array(count)
  let pick = 0
  let fade = 0
  for (let i = 0; i < count; i++) {
    const start = regionStart + Math.floor(rand() * regionBp * 1.1) - 50
    const kind = rand()
    startEnd[i * 2] = start
    startEnd[i * 2 + 1] =
      kind < 0.05
        ? start
        : kind < 0.3
          ? start + 1 + Math.floor(rand() * 3)
          : start + Math.floor(rand() * regionBp * 0.2)
    height[i] = RECT_HEIGHTS[Math.floor(rand() * RECT_HEIGHTS.length)]!
    const row = Math.floor(rand() * 50) - 5
    y[i] = rand() < 0.1 ? row * 12 + 0.5 : row * 12
    if (rand() < 0.1) {
      pick = Math.floor(rand() * RECT_COLORS.length)
    }
    if (rand() < 0.05) {
      fade = fade ? 0 : 1
    }
    color[i] = RECT_COLORS[pick]!
    densityFade[i] = fade
  }
  return {
    startEnd,
    y,
    height,
    color,
    densityFade,
    strand: new Float32Array(count),
    count,
  }
}

describe('rect places each box as the painter it retired did', () => {
  describe.each([
    { name: 'sub-pixel', start: 2_000_000, bp: 5_000_000, px: [30.5, 1570.25] },
    { name: 'zoomed in', start: 9_000, bp: 700, px: [0, 1600] },
    { name: 'clipped', start: 77_777, bp: 23_456, px: [-512.75, 2048.5] },
  ])('$name', ({ start, bp, px }) => {
    const channels = manyRects(start, bp)
    describe.each([false, true])('reversed %s', reversed => {
      const regionBlock = {
        displayedRegionIndex: 0,
        start,
        end: start + bp,
        screenStartPx: px[0]!,
        screenEndPx: px[1]!,
        reversed,
      }
      test.each([
        ['outlined, a row on each slack edge', 0xff222222, 18],
        ['unoutlined, scrolled between rows', 0, 17.25],
      ])('%s', (_, outlineColor, scrollY) => {
        const params = { scrollY, outlineColor }
        const painted = styleRecording()
        rectShape.paintBlock(
          painted.ctx,
          channels,
          regionBlock,
          RECT_FRAME,
          params,
        )
        const expected = styleRecording()
        retiredRect.paintBlock(
          expected.ctx,
          channels,
          regionBlock,
          RECT_FRAME,
          params,
        )
        expect(painted.calls.length).toBeGreaterThan(0)
        expect(new Set(expected.styles).size).toBeGreaterThan(2)
        expect(painted.calls).toEqual(expected.calls)
        expect(painted.styles).toEqual(expected.styles)
        const instances = Array.from({ length: channels.count }, (_, i) => i)
        const inks = instances.map(i =>
          rectShape.ink!(channels, regionBlock, RECT_FRAME, params, i),
        )
        expect(inks.includes(undefined)).toBe(true)
        expect(inks).toEqual(
          instances.map(i =>
            retiredRect.ink(channels, regionBlock, RECT_FRAME, params, i),
          ),
        )
      })
    })
  })
})
