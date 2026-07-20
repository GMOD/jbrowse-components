import { drawSequenceBlocks } from './drawSequence.ts'

import type { SequenceRegionData } from '../model.ts'
import type { DrawSequenceState } from './drawSequence.ts'
import type { ColorEntry, ColorPalette } from './sequenceGeometry.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The reference-sequence display paints one rect per base, so it is a "cell"
// mark and needs the reversed-block pivot: `bpToScreenPx(bp)` is the base's LEFT
// edge forward but its RIGHT edge reversed, so filling rightward from the raw
// mapper would cover the neighbor. `bpRangeToScreen` resolves both edges and
// orders them (min/abs), but nothing tested it — the snapshots are forward-only,
// so the reversed path could regress silently. See render-core/CLAUDE.md
// "makeCellLeftMapper" for the shared rule this exercises.

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200
// 20 px/bp, so a one-base error is 20px, and 1/bpPerPx >= 12 turns borders on
// (the zoom at which this display actually paints per-base cells).
const PX_PER_BP = BLOCK_WIDTH / (END - START)
const BP_PER_PX = (END - START) / BLOCK_WIDTH

function recordingCtx() {
  const rects: { x: number; w: number }[] = []
  return {
    rects,
    ctx: {
      set fillStyle(_v: string) {},
      get fillStyle() {
        return ''
      },
      set strokeStyle(_v: string) {},
      set lineWidth(_v: number) {},
      set font(_v: string) {},
      set textAlign(_v: string) {},
      set textBaseline(_v: string) {},
      fillRect(x: number, _y: number, w: number) {
        rects.push({ x, w })
      },
      strokeRect() {},
      fillText() {},
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
    } as unknown as Ctx2D,
  }
}

function colorEntry(): ColorEntry {
  return { rgb: [0, 128, 0], style: 'rgb(0,128,0)' }
}

function palette(): ColorPalette {
  return {
    bases: new Map([['A', colorEntry()]]),
    frames: new Map(),
    start: colorEntry(),
    stop: colorEntry(),
    fallback: colorEntry(),
  }
}

function regionData(): SequenceRegionData {
  return {
    seq: 'AAAAAAAAAA',
    start: START,
    end: END,
    geneticCodeId: 1,
  }
}

function state(): DrawSequenceState {
  return {
    bpPerPx: BP_PER_PX,
    showForward: true,
    showReverse: false,
    showTranslation: false,
    isDna: true,
    rowHeight: 10,
    palette: palette(),
    textColors: {
      baseContrast: new Map(),
      startContrast: '',
      stopContrast: '',
    },
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 100,
  }
}

// The first painted cell (loop runs low→high bp regardless of orientation) is
// the base at START.
function firstCellFor(reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
  drawSequenceBlocks(ctx, new Map([[0, regionData()]]), [block], state())
  expect(rects).toHaveLength(END - START)
  return rects[0]!
}

describe('drawSequenceBlocks reversed cell geometry', () => {
  test('forward block: base at START sits at the low edge', () => {
    const cell = firstCellFor(false)
    expect(cell.x).toBeCloseTo(0)
    expect(cell.w).toBeCloseTo(PX_PER_BP)
  })

  test('reversed block: base at START mirrors to the high edge, one base wide', () => {
    // Reversed, START is the RIGHTMOST base: it spans [180,200], so its left
    // edge is 180 with the same width. Filling from the bare bp->px mapper would
    // anchor it at 200 — off the block and one base wide of the truth.
    const cell = firstCellFor(true)
    expect(cell.x).toBeCloseTo(BLOCK_WIDTH - PX_PER_BP)
    expect(cell.w).toBeCloseTo(PX_PER_BP)
  })

  test('the two orientations differ by exactly one base width', () => {
    expect(firstCellFor(true).x - firstCellFor(false).x).toBeCloseTo(
      BLOCK_WIDTH - PX_PER_BP,
    )
  })
})
