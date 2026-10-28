import { bpRangeXTuple, clipBlock } from '@jbrowse/render-core/blockClipUtils'

import {
  CHEVRON_VERTS,
  CHEVRON_W_PX,
  chevronSlotBudget,
} from '../components/sharedRendererConstants.ts'
import {
  chevronCount,
  chevronFirstVisible,
  chevronLastVisible,
  chevronOffset,
  showChevrons,
} from '../passes/shaders/chevron.js.generated.ts'
import { chevronShape } from './featureGlyphShapes.ts'

import type { LineChannels } from './featureGlyphShapes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// chevron.slang's vertex stage walked in JS: the chevron indices one line puts
// down when its draw shades `slots` chevrons per instance. The line's px width
// goes through float32 as the shader computes it.
function drawnChevrons(
  start: number,
  end: number,
  clip: BlockClipResult,
  reversed: boolean,
  slots: number,
) {
  const lengthBp = end - start
  const widthPx = Math.fround(Math.fround(lengthBp) / Math.fround(clip.bpPerPx))
  if (!showChevrons(widthPx)) {
    return []
  }
  const count = chevronCount(widthPx)
  const spacing = chevronOffset(lengthBp, count, 0)
  const [hi, lo, span] = bpRangeXTuple(clip, reversed)
  const viewStart = hi + lo - start
  const reach = (CHEVRON_W_PX / 2) * clip.bpPerPx
  const first = chevronFirstVisible(
    Math.min(viewStart, viewStart + span),
    spacing,
    reach,
  )
  const last = chevronLastVisible(
    Math.max(viewStart, viewStart + span),
    spacing,
    count,
    reach,
  )
  const drawn = []
  for (let slot = 0; slot < slots && first + slot <= last; slot++) {
    drawn.push(first + slot)
  }
  return drawn
}

function lineChannels(lines: [number, number][]): LineChannels {
  return {
    startEnd: new Uint32Array(lines.flat()),
    y: new Float32Array(lines.length),
    direction: new Int8Array(lines.length).fill(1),
    color: new Uint32Array(lines.length),
    count: lines.length,
  }
}

function slotsFor(canvasWidth: number, c: LineChannels, clip: BlockClipResult) {
  const frame = { canvasWidth, canvasHeight: 100 }
  const params = { scrollY: 0, outlineColor: 0 }
  return (
    chevronShape.verticesPerInstance!(frame, params, c, clip) / CHEVRON_VERTS
  )
}

function expectSameChevrons(
  canvasWidth: number,
  blocks: RenderBlock[],
  lines: [number, number][],
) {
  const c = lineChannels(lines)
  let shaded = 0
  for (const block of blocks) {
    const clip = clipBlock(block, canvasWidth, 100, { x: 1, y: 1 })
    if (!clip) {
      continue
    }
    const slots = slotsFor(canvasWidth, c, clip)
    shaded += slots
    for (const [start, end] of lines) {
      const reversed = !!block.reversed
      expect(drawnChevrons(start, end, clip, reversed, slots)).toStrictEqual(
        drawnChevrons(
          start,
          end,
          clip,
          reversed,
          chevronSlotBudget(canvasWidth),
        ),
      )
    }
  }
  return shaded
}

const CANVAS_WIDTHS = [320, 1500, 4000]
const BP_PER_PX = [0.013, 1, 3.7, 137, 2500]
const LINE_PX = [10, 19.99, 20, 39.9, 40, 79.99, 80, 333, 1500, 1561, 4100, 9e4]

function blockLayouts(canvasWidth: number, bpPerPx: number): RenderBlock[][] {
  const regionBp = 1e7
  const at = (
    screenStartPx: number,
    screenEndPx: number,
    start: number,
    reversed: boolean,
    displayedRegionIndex = 0,
  ) => ({
    displayedRegionIndex,
    start,
    end: start + (screenEndPx - screenStartPx) * bpPerPx,
    screenStartPx,
    screenEndPx,
    reversed,
  })
  const half = canvasWidth / 2
  return [true, false].flatMap(reversed => [
    [at(0, canvasWidth, regionBp, reversed)],
    [at(-777.3, canvasWidth + 401.7, regionBp, reversed)],
    [
      at(-50, half - 3, regionBp, reversed),
      at(half + 3, canvasWidth + 90, 2 * regionBp, !reversed, 1),
    ],
    [at(canvasWidth / 3, canvasWidth / 3 + 57.5, regionBp, reversed)],
  ])
}

// Lines of each width laid at offsets that run them off either edge of every
// block, sit wholly inside, and straddle the seam between two.
function linesAround(block: RenderBlock, bpPerPx: number, widthPx: number) {
  const len = Math.max(1, Math.round(widthPx * bpPerPx))
  const lines: [number, number][] = []
  for (const f of [-1.3, -0.97, -0.5, -0.02, 0, 0.21, 0.5, 0.99, 1, 1.4]) {
    const s = Math.round(block.start + f * (block.end - block.start))
    if (s >= 0) {
      lines.push([s, s + len], [Math.max(0, s - len), s])
    }
  }
  return lines
}

test('every chevron the canvas-wide budget drew, the per-draw budget draws', () => {
  for (const canvasWidth of CANVAS_WIDTHS) {
    for (const bpPerPx of BP_PER_PX) {
      for (const blocks of blockLayouts(canvasWidth, bpPerPx)) {
        for (const widthPx of LINE_PX) {
          const lines = blocks.flatMap(b => linesAround(b, bpPerPx, widthPx))
          for (const line of lines) {
            expectSameChevrons(canvasWidth, blocks, [line])
          }
          expectSameChevrons(canvasWidth, blocks, lines)
        }
      }
    }
  }
})

test('a line a chevron or two longer than its block still fills every slot', () => {
  // The window's worst case (`chevronWindow.test.ts`): spacing furthest under
  // the full step, which only the block's own budget bounds.
  for (const canvasWidth of [320, 1920]) {
    const block = {
      displayedRegionIndex: 0,
      start: 1000,
      end: 1000 + canvasWidth,
      screenStartPx: 0,
      screenEndPx: canvasWidth,
      reversed: false,
    }
    for (let extraPx = 1; extraPx <= 120; extraPx += 1) {
      for (let lead = 0; lead <= 40; lead += 1) {
        const start = 1000 - lead
        expectSameChevrons(
          canvasWidth,
          [block],
          [[start, start + canvasWidth + extraPx]],
        )
      }
    }
  }
})

test('a line a float32 rounding short of the next chevron keeps its last slot', () => {
  // 40 * 25 px of line at a bpPerPx whose float32 rounding lifts the count
  for (const bpPerPx of [0.1, 0.3, 1 / 3, 2.2, 7.7]) {
    for (const k of [1, 2, 25, 37]) {
      const end = Math.floor(40 * k * bpPerPx)
      for (const start of [0, 1]) {
        expectSameChevrons(
          1500,
          [
            {
              displayedRegionIndex: 0,
              start: 0,
              end: 1500 * bpPerPx,
              screenStartPx: 0,
              screenEndPx: 1500,
              reversed: false,
            },
          ],
          [[start, end]],
        )
      }
    }
  }
})

test('a gene region shades a few chevrons per line, not a canvas of them', () => {
  // A 120 kb view at 1500 px: the longest intron, 18 kb, spans 225 px.
  const canvasWidth = 1500
  const bpPerPx = 80
  const block = {
    displayedRegionIndex: 0,
    start: 1e6,
    end: 1e6 + canvasWidth * bpPerPx,
    screenStartPx: 0,
    screenEndPx: canvasWidth,
    reversed: false,
  }
  const introns: [number, number][] = [
    [1_010_000, 1_012_500],
    [1_013_000, 1_031_000],
    [1_040_000, 1_041_200],
  ]
  const shaded = expectSameChevrons(canvasWidth, [block], introns)
  expect(chevronSlotBudget(canvasWidth)).toBe(40)
  expect(shaded).toBe(chevronCount(18_000 / bpPerPx) + 1)
})

test('a draw whose lines carry no direction shades nothing', () => {
  const c = { ...lineChannels([[0, 1e6]]), direction: new Int8Array(1) }
  const clip = clipBlock(
    { start: 0, end: 1e6, screenStartPx: 0, screenEndPx: 800 },
    800,
    100,
    { x: 1, y: 1 },
  )!
  expect(slotsFor(800, c, clip)).toBe(0)
})
