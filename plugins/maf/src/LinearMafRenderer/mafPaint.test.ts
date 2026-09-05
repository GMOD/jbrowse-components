import { buildMafChannels } from './mafChannels.ts'
import { MAF_ROW_MARK } from './mafMarks.ts'
import { GAP_STROKE_OFFSET } from './rendering/types.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200

function recordingCtx() {
  const rects: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h })
    },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    closePath() {},
    fill() {},
    strokeStyle: '',
    lineWidth: 1,
    strokeRect() {},
    stroke() {},
  } satisfies MarkContext2D
  return { rects, ctx }
}

const A = 65

const NO_COLORS = {
  coverage: 0,
  baseA: 0,
  baseC: 0,
  baseG: 0,
  baseT: 0,
  baseN: 0,
  insertionIndicator: 0,
  softclipIndicator: 0,
  hardclipIndicator: 0,
}

function regionData(n: number, aln?: string) {
  return {
    blocks: [
      {
        startBp: START,
        endBp: START + n,
        refSeqBytes: new Uint8Array(n).fill(A),
        rows: [
          {
            rowIndex: 0,
            alignmentBytes:
              aln === undefined
                ? new Uint8Array(n).fill(A)
                : new TextEncoder().encode(aln),
          },
        ],
        empties: [],
      },
    ],
  }
}

const palette = {
  colorForBase: { a: 'green', c: 'blue', g: 'orange', t: 'red', n: 'grey' },
  matchColor: 'lightgrey',
  gapColor: 'white',
  mismatchOffColor: 'black',
  unknownBaseColor: 'grey',
  insertionColor: 'purple',
  bridgeLineColor: 'grey',
  missingDataColor: 'lightyellow',
}

function state(binBp: number) {
  return {
    binBp,
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 100,
    rowsTop: 0,
    rowsHeight: 100,
    coverage: {
      height: 0,
      top: 0,
      domainMin: 0,
      domainMax: undefined,
      scaleType: 0 as const,
      symlogConstant: 1,
      snpMinFrequency: 0,
      showInterbase: true,
      colors: NO_COLORS,
    },
    rowHeight: 10,
    rowProportion: 1,
    scrollTop: 0,
    showAllLetters: true,
    mismatchRendering: false,
    palette,
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

function draw(reversed: boolean, n: number, binBp = 1, aln?: string) {
  const { ctx, rects } = recordingCtx()
  const s = state(binBp)
  const channels = buildMafChannels({
    blocks: regionData(n, aln).blocks,
    palette,
    showAllLetters: s.showAllLetters,
    mismatchRendering: s.mismatchRendering,
    binBp,
  })
  MAF_ROW_MARK.paintBlock(ctx, { cells: channels }, block(reversed), s)
  return rects
}

// 20 px/bp, so a one-base error is 20px.
const PX_PER_BP = BLOCK_WIDTH / (END - START)
const SEAM = GAP_STROKE_OFFSET

// MAF paints one rect per run of same-coloured reference bases, so it needs the
// same reversed-block pivot as the alignments pileup: `makeBpMapper(bp)` is a
// span's LEFT edge forward but its RIGHT edge reversed, and filling rightward
// from there covers the neighbouring bases.
describe('the MAF rows mark, cell geometry', () => {
  const cellFor = (reversed: boolean) => {
    const rects = draw(reversed, 1, 1)
    expect(rects).toHaveLength(1)
    return rects[0]!
  }

  test('forward block: cell covers its own base', () => {
    expect(cellFor(false).x).toBeCloseTo(0)
  })

  test('reversed block: cell covers its own base, not the neighbour', () => {
    // Reversed, START is the RIGHTMOST base: it spans [180,200], so its left
    // edge is 180. A painter using the bare bp→px mapper would put it at 200 —
    // off the block entirely, and one base wide of the truth.
    expect(cellFor(true).x).toBeCloseTo(BLOCK_WIDTH - PX_PER_BP)
  })
})

// The zoomed-out path samples one cell per `binBp` window and fills the whole
// window, so each rect is a multi-bp SPAN. Spans are only ever sub-pixel in
// production (encodeBinBp keeps a bin under half a CSS px), which is exactly
// why this would never be noticed by eye; PX_PER_BP is 20 here.
describe('the MAF rows mark, binned cells', () => {
  const BIN = 4
  const N = 8
  const TWO_BINS = 'AAAACCCC'

  test('forward block: bins tile left to right, one bin-span wide each', () => {
    const rects = draw(false, N, BIN, TWO_BINS)
    expect(rects).toHaveLength(2)
    expect(rects[0]!.x).toBeCloseTo(0)
    expect(rects[1]!.x).toBeCloseTo(BIN * PX_PER_BP)
    expect(rects[0]!.w).toBeCloseTo(BIN * PX_PER_BP + SEAM)
  })

  test('reversed block: a bin covers its own span, not the one after it', () => {
    const rects = draw(true, N, BIN, TWO_BINS)
    expect(rects).toHaveLength(2)
    expect(rects[0]!.x).toBeCloseTo(BLOCK_WIDTH - BIN * PX_PER_BP)
    expect(rects[1]!.x).toBeCloseTo(BLOCK_WIDTH - 2 * BIN * PX_PER_BP)
    expect(rects[0]!.w).toBeCloseTo(BIN * PX_PER_BP + SEAM)
  })

  test('reversing mirrors the bins about the block, base for base', () => {
    // Not "the same screen span": reversed puts the lowest bp on the RIGHT, so
    // the 8 drawn bases move from the block's left 160px to its right 160px.
    // Dropping the seam pad (which always grows rightward) leaves spans that
    // are exact mirrors — the strongest statement that no bin drifted.
    const spans = (reversed: boolean) =>
      draw(reversed, N, BIN, TWO_BINS)
        .map(r => [r.x, r.x + r.w - SEAM] as const)
        .sort((a, b) => a[0] - b[0])

    const mirrored = spans(false)
      .map(([lo, hi]) => [BLOCK_WIDTH - hi, BLOCK_WIDTH - lo] as const)
      .sort((a, b) => a[0] - b[0])

    spans(true).forEach(([lo, hi], i) => {
      expect(lo).toBeCloseTo(mirrored[i]![0])
      expect(hi).toBeCloseTo(mirrored[i]![1])
    })
  })

  test('a trailing partial bin clamps to the block end', () => {
    const rects = draw(false, 6, BIN, 'AAAACC')
    expect(rects).toHaveLength(2)
    expect(rects[1]!.w).toBeCloseTo(2 * PX_PER_BP + SEAM)
  })
})

// Same-colour neighbours are one rect. The match tone is translucent, so a rect
// per cell — each padded by the seam — stacked it more than twice deep at
// sub-pixel cell pitch and the Canvas2D rows band came out darker than the
// GPU's, which merges runs into one quad.
describe('the MAF rows mark, runs', () => {
  test('a run of one colour is one rect, padded once', () => {
    const rects = draw(false, 5, 1, 'AAAAA')
    expect(rects).toHaveLength(1)
    expect(rects[0]!.x).toBeCloseTo(0)
    expect(rects[0]!.w).toBeCloseTo(5 * PX_PER_BP + SEAM)
  })

  test('a reversed run spans the same bases from the other end', () => {
    const rects = draw(true, 5, 1, 'AAAAA')
    expect(rects).toHaveLength(1)
    expect(rects[0]!.x).toBeCloseTo(BLOCK_WIDTH - 5 * PX_PER_BP)
    expect(rects[0]!.w).toBeCloseTo(5 * PX_PER_BP + SEAM)
  })

  test('a colour change ends the run', () => {
    const rects = draw(false, 5, 1, 'AACAA')
    expect(rects.map(r => r.x)).toEqual([0, 2 * PX_PER_BP, 3 * PX_PER_BP])
    expect(rects[0]!.w).toBeCloseTo(2 * PX_PER_BP + SEAM)
  })
})

// A gap run reaching either end of the block measures where the MAF was
// chunked, not the alignment, so those columns paint nothing at all — the same
// blank the sample gets in blocks it is absent from.
describe('the MAF rows mark, boundary gaps', () => {
  test('a trailing gap run paints no cells', () => {
    expect(draw(false, 5, 1, 'ACA--').map(r => r.x)).toEqual([
      0,
      PX_PER_BP,
      2 * PX_PER_BP,
    ])
  })

  test('a leading gap run paints no cells', () => {
    expect(draw(false, 5, 1, '--ACA')[0]!.x).toBeCloseTo(2 * PX_PER_BP)
  })

  test('an all-gap row paints nothing', () => {
    expect(draw(false, 5, 1, '-----')).toHaveLength(0)
  })

  test('an interior gap run still paints', () => {
    expect(draw(false, 5, 1, 'A--AC')).toHaveLength(4)
  })
})
