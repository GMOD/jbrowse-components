import { getDpr, makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { HIDDEN_ROW } from '../../shared/constants.ts'
import { cellMark } from './cellMark.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT, drawVariantShape } from './variantShape.ts'

import type { CellChannels, CellParams } from './cellMark.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Rows on the canvas's device pixel grid, a whole device px at least. An
// uncapped canvas's backing scale is the dpr itself.
function rowBand(row: number, params: CellParams) {
  const { rowHeight, scrollTop } = params
  const dpr = getDpr()
  const y = row * rowHeight - scrollTop
  const top = Math.floor(y * dpr + 0.5) / dpr
  const bottom = Math.max(
    Math.floor((y + drawnCellHeightPx(rowHeight)) * dpr + 0.5) / dpr,
    top + 1 / dpr,
  )
  return { top, height: bottom - top }
}

// Sides on the device grid, the floor rounded up to it, hung off the record's
// start.
function cellX(x1: number, x2: number) {
  const dpr = getDpr()
  const snap = (x: number) => Math.floor(x * dpr + 0.5) / dpr
  const width = Math.max(
    Math.ceil(2 * dpr) / dpr,
    Math.abs(snap(x2) - snap(x1)),
  )
  return { x: x2 < x1 ? snap(x1) - width : snap(x1), width }
}

const retired: Required<
  Pick<MarkShape<CellChannels, CellParams>, 'paintBlock' | 'ink'>
> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, row, shapeType, color, count } = channels
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const { top, height } = rowBand(row[i]!, params)
      if (top + height >= 0 && top <= canvasHeight) {
        const { x, width } = cellX(
          toX(startEnd[i * 2]!),
          toX(startEnd[i * 2 + 1]!),
        )
        setFill(color[i]!)
        drawVariantShape(ctx, shapeType[i]!, x, top, width, height)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const { startEnd, row } = channels
    const { canvasHeight } = frame
    const { top, height } = rowBand(row[i]!, params)
    if (top + height < 0 || top > canvasHeight) {
      return undefined
    }
    const toX = makeBpMapper(block)
    const { x, width } = cellX(toX(startEnd[i * 2]!), toX(startEnd[i * 2 + 1]!))
    return { left: x, top, width, height }
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

function paintWith(
  shape: Pick<MarkShape<CellChannels, CellParams>, 'paintBlock'>,
  channels: CellChannels,
  block: RenderBlock,
  params: CellParams,
) {
  const { ctx, calls, styles } = styleRecording()
  shape.paintBlock(ctx, channels, block, FRAME, params)
  return { calls, styles }
}

const FRAME = { canvasWidth: 1601, canvasHeight: 300 }
const GENOTYPES = [0xffcc4411, 0xff1133bb, 0xffeeeeee, 0x80336699]

function cells(regionStart: number, regionBp: number): CellChannels {
  const rand = rng(regionBp)
  const samples = 60
  const features = 120
  const count = features * samples
  const startEnd = new Uint32Array(count * 2)
  const row = new Uint32Array(count)
  const shapeType = new Uint8Array(count)
  const color = new Uint32Array(count)
  let genotype = 0
  for (let f = 0; f < features; f++) {
    const start =
      regionStart + Math.floor(rand() * regionBp * 1.1) - regionBp * 0.05
    const kind = rand()
    const end =
      kind < 0.6
        ? start + 1
        : kind < 0.7
          ? start
          : kind < 0.9
            ? start + 1 + Math.floor(rand() * 40)
            : start + Math.floor(rand() * regionBp)
    const shape = rand() < 0.05 ? SHAPE_TRI_LEFT : SHAPE_RECT
    for (let s = 0; s < samples; s++) {
      const i = f * samples + s
      startEnd[i * 2] = start
      startEnd[i * 2 + 1] = end
      row[i] = rand() < 0.03 ? HIDDEN_ROW : s
      shapeType[i] = shape
      if (rand() < 0.3) {
        genotype = Math.floor(rand() * GENOTYPES.length)
      }
      color[i] = GENOTYPES[genotype]!
    }
  }
  return { startEnd, row, shapeType, color, count }
}

const regions = [
  { name: 'sub-pixel', start: 1_000_000, bp: 3_000_000, px: [400.25, 1200.75] },
  { name: 'zoomed in', start: 52_000, bp: 400, px: [0, 800] },
  { name: 'clipped', start: 7_777, bp: 12_345, px: [-321.5, 1733.125] },
]

const paramsCases: [string, CellParams, number][] = [
  [
    'scrolled to rows exactly on both edges',
    { rowHeight: 7.5, scrollTop: 30 },
    1,
  ],
  ['scrolled between rows', { rowHeight: 7.5, scrollTop: 37.25 }, 1],
  ['sub-pixel rows', { rowHeight: 0.5, scrollTop: 0 }, 1],
  ['fractional rows at dpr 1.5', { rowHeight: 7.3, scrollTop: 0.37 }, 1.5],
  ['fractional rows at dpr 1.25', { rowHeight: 7.3, scrollTop: 0.37 }, 1.25],
  ['dpr 2', { rowHeight: 7.5, scrollTop: 0 }, 2],
]

function withDpr<T>(dpr: number, run: () => T) {
  const before = window.devicePixelRatio
  window.devicePixelRatio = dpr
  try {
    return run()
  } finally {
    window.devicePixelRatio = before
  }
}

describe.each(regions)('$name', ({ start, bp, px }) => {
  const channels = cells(start, bp)
  describe.each([false, true])('reversed %s', reversed => {
    const block: RenderBlock = {
      displayedRegionIndex: 0,
      start,
      end: start + bp,
      screenStartPx: px[0]!,
      screenEndPx: px[1]!,
      reversed,
    }
    test.each(paramsCases)('%s', (_, params, dpr) => {
      const painted = withDpr(dpr, () =>
        paintWith(cellMark, channels, block, params),
      )
      const expected = withDpr(dpr, () =>
        paintWith(retired, channels, block, params),
      )
      expect(painted.calls.length).toBeGreaterThan(0)
      expect(painted.calls.length).toBeLessThan(channels.count)
      expect(new Set(expected.styles).size).toBeGreaterThan(1)
      expect(painted.calls).toEqual(expected.calls)
      expect(painted.styles).toEqual(expected.styles)
      const instances = Array.from({ length: channels.count }, (_, i) => i)
      expect(
        withDpr(dpr, () =>
          instances.map(i => cellMark.ink!(channels, block, FRAME, params, i)),
        ),
      ).toEqual(
        withDpr(dpr, () =>
          instances.map(i => retired.ink(channels, block, FRAME, params, i)),
        ),
      )
    })
  })
})

// An SVG export has no screen of its own, so it snaps to whole CSS px, which
// lands every cell on a pixel at any whole raster scale, whatever the
// exporting screen's ratio.
test('an export at snapScale 1 puts every cell on the CSS px grid at dpr 1.25', () => {
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: 52_000,
    end: 52_400,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const params = { rowHeight: 7.3, scrollTop: 0.37, snapScale: 1 }
  const { calls } = withDpr(1.25, () =>
    paintWith(cellMark, cells(52_000, 400), block, params),
  )
  expect(calls.length).toBeGreaterThan(0)
  for (const c of calls) {
    for (const v of [c.x, c.y, c.w, c.h]) {
      expect(v).toBe(Math.round(v))
    }
  }
})
