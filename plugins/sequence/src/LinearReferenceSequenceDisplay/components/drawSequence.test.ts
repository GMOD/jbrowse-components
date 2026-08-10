import { drawSequenceBlocks } from './drawSequence.ts'
import { rowLayout } from './sequenceGeometry.ts'

import type { SequenceRegionData } from '../model.ts'
import type { DrawSequenceState } from './drawSequence.ts'
import type { ColorPalette, SeqColor } from './sequenceGeometry.ts'
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
  const rects: { x: number; y: number; w: number }[] = []
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
      fillRect(x: number, y: number, w: number) {
        rects.push({ x, y, w })
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

function seqColor(): SeqColor {
  return { fill: 'rgb(0,128,0)', text: '#000' }
}

function palette(): ColorPalette {
  return {
    bases: new Map([['A', seqColor()]]),
    frames: new Map(),
    start: seqColor(),
    stop: seqColor(),
    fallback: seqColor(),
  }
}

function regionData(): SequenceRegionData {
  return {
    seq: 'AAAAAAAAAA',
    start: START,
    geneticCodeId: 1,
  }
}

function state(overrides?: Partial<DrawSequenceState>): DrawSequenceState {
  return {
    bpPerPx: BP_PER_PX,
    showForward: true,
    showReverse: false,
    showTranslation: false,
    isDna: true,
    rowHeight: 10,
    palette: palette(),
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 100,
    ...overrides,
  }
}

function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
}

// The first painted cell (loop runs low→high bp regardless of orientation) is
// the base at START.
function firstCellFor(reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  drawSequenceBlocks(
    ctx,
    new Map([[0, regionData()]]),
    [block(reversed)],
    state(),
  )
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

// A codon cell is the same pivot three bases wide, so getting it wrong is a
// three-base slide rather than one. The base row above covers `left(bp, 1)`;
// nothing covered `left(bp, 3)`, whose reversed anchor is the codon's *end*.
describe('drawSequenceBlocks reversed codon geometry', () => {
  // START % 3 === 1, so frame +1's grid starts 2 bases in: the first whole
  // codon is [START+2, START+5).
  const CODON_START_BP = START + 2
  const CODON_END_BP = START + 5

  function firstCodonCellFor(reversed: boolean) {
    const s = state({ showTranslation: true })
    const { ctx, rects } = recordingCtx()
    drawSequenceBlocks(ctx, new Map([[0, regionData()]]), [block(reversed)], s)
    // reversal reorders the stack, so ask the layout where frame +1 landed
    // rather than hard-coding a row index
    const rowIndex = rowLayout(s, reversed).findIndex(
      r => r.type === 'translation' && r.frame === 1,
    )
    // within that row the 3bp-wide rects are the codons; the others are the
    // partial-codon background bands at the region edges
    const codons = rects.filter(
      r =>
        r.y === rowIndex * s.rowHeight && Math.abs(r.w - 3 * PX_PER_BP) < 0.001,
    )
    expect(codons.length).toBeGreaterThan(0)
    return codons[0]!
  }

  test('forward block: the codon starts at its low-coordinate edge', () => {
    expect(firstCodonCellFor(false).x).toBeCloseTo(
      (CODON_START_BP - START) * PX_PER_BP,
    )
  })

  test('reversed block: the codon is anchored at its end, not its start', () => {
    // Reversed, the codon's leftmost edge is its highest coordinate. Anchoring
    // at the start instead would put it at 160 — a full codon too far right.
    expect(firstCodonCellFor(true).x).toBeCloseTo(
      BLOCK_WIDTH - (CODON_END_BP - START) * PX_PER_BP,
    )
  })
})
