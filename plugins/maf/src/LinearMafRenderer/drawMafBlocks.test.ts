import { drawMafBlocks } from './drawMafBlocks.ts'

import type {
  MafGPURenderState,
  MafRegionData,
} from './mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// MAF paints one rect per reference base, so it needs the same reversed-block
// pivot as the alignments pileup: `makeBpMapper(bp)` is the cell's LEFT edge
// forward but its RIGHT edge reversed, and filling rightward from there covers
// the neighboring base. MAF has always had this right (it hand-rolled the pivot
// before `makeCellLeftMapper` existed) but nothing tested it — the snapshots are
// forward-only, so the reversed path could regress silently.

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200
// 20 px/bp, so a one-base error is 20px.
const PX_PER_BP = BLOCK_WIDTH / (END - START)

function recordingCtx() {
  const rects: { x: number; w: number }[] = []
  return {
    rects,
    ctx: {
      set fillStyle(_v: string) {},
      get fillStyle() {
        return ''
      },
      fillRect(x: number, _y: number, w: number) {
        rects.push({ x, w })
      },
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      strokeStyle: '',
      lineWidth: 1,
      stroke() {},
      moveTo() {},
      lineTo() {},
    } as unknown as Ctx2D,
  }
}

const A = 65

// One MAF block: `n` reference 'A' bases from START, with one aligned row whose
// bases all match unless `aln` overrides them. Defaults to a single base —
// exactly one cell painted.
function regionData(n = 1, aln?: string): MafRegionData {
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
  } as unknown as MafRegionData
}

function state(binBp = 1): MafGPURenderState {
  return {
    binBp,
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 100,
    // No band above the rows here: this paints in the rows band's own space, so
    // the two heights coincide and `rowsHeight` is what it culls against.
    rowsTop: 0,
    rowsHeight: 100,
    coverage: undefined,
    rowHeight: 10,
    rowProportion: 1,
    scrollTop: 0,
    // showAllLetters so a matching base still paints a cell (resolveCellColor
    // returns undefined for matches in mismatch-only mode, painting nothing).
    showAllLetters: true,
    mismatchRendering: false,
    palette: {
      colorForBase: { a: 'green', c: 'blue', g: 'orange', t: 'red', n: 'grey' },
      matchColor: 'lightgrey',
      gapColor: 'white',
      mismatchOffColor: 'black',
      unknownBaseColor: 'grey',
      insertionColor: 'purple',
      bridgeLineColor: 'grey',
      missingDataColor: 'lightyellow',
    },
  }
}

function draw(reversed: boolean, nBases = 1, binBp = 1, aln?: string) {
  const { ctx, rects } = recordingCtx()
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
  drawMafBlocks(
    ctx,
    new Map([[0, regionData(nBases, aln)]]),
    [block],
    state(binBp),
  )
  return rects
}

function cellFor(reversed: boolean) {
  const rects = draw(reversed)
  expect(rects).toHaveLength(1)
  return rects[0]!
}

describe('drawMafBlocks cell geometry', () => {
  test('forward block: cell covers its own base', () => {
    // Base at START sits at the block's low edge => left edge 0.
    expect(cellFor(false).x).toBeCloseTo(0)
  })

  test('reversed block: cell covers its own base, not the neighbor', () => {
    // Reversed, START is the RIGHTMOST base: it spans [180,200], so its left
    // edge is 180. A painter using the bare bp→px mapper would put it at 200 —
    // off the block entirely, and one base wide of the truth.
    expect(cellFor(true).x).toBeCloseTo(BLOCK_WIDTH - PX_PER_BP)
  })

  test('the two orientations differ by exactly one base width', () => {
    expect(cellFor(true).x - cellFor(false).x).toBeCloseTo(
      BLOCK_WIDTH - PX_PER_BP,
    )
  })
})

// The zoomed-out path samples one cell per `binBp` window and fills the whole
// window. That makes each rect a multi-bp SPAN, so the one-base pivot in
// `makeCellLeftMapper` is the wrong anchor for it — on a reversed block a
// span's left edge is its END. Spans are only ever sub-pixel in production
// (encodeBinBp keeps a bin under half a CSS px), which is exactly why this
// would never be noticed by eye; PX_PER_BP is 20 here so the error is 60px.
describe('drawMafBlocks binned cell geometry', () => {
  const BIN = 4
  // 8 bases in 2 bins of 4. Bin 0 spans bp [1000,1004), bin 1 [1004,1008).
  const N = 8

  test('forward block: bins tile left to right, one base-span wide each', () => {
    const rects = draw(false, N, BIN)
    expect(rects).toHaveLength(2)
    expect(rects[0]!.x).toBeCloseTo(0)
    expect(rects[1]!.x).toBeCloseTo(BIN * PX_PER_BP)
    expect(rects[0]!.w).toBeCloseTo(BIN * PX_PER_BP + 0.4)
  })

  test('reversed block: a bin covers its own span, not the one after it', () => {
    const rects = draw(true, N, BIN)
    expect(rects).toHaveLength(2)
    // Reversed, bp 1000 is rightmost. Bin 0 spans bp [1000,1004) => screen
    // [200-4*20, 200] = [120,200]. Anchoring on the cell-left pivot instead
    // would put it at 180 — three bases wide of the truth.
    expect(rects[0]!.x).toBeCloseTo(BLOCK_WIDTH - BIN * PX_PER_BP)
    expect(rects[1]!.x).toBeCloseTo(BLOCK_WIDTH - 2 * BIN * PX_PER_BP)
    expect(rects[0]!.w).toBeCloseTo(BIN * PX_PER_BP + 0.4)
  })

  test('reversing mirrors the bins about the block, base for base', () => {
    // Not "the same screen span": reversed puts the lowest bp on the RIGHT, so
    // the 8 drawn bases move from the block's left 160px to its right 160px.
    // Dropping the seam fudge (which always grows rightward) leaves spans that
    // are exact mirrors — the strongest statement that no bin drifted.
    const spans = (reversed: boolean) =>
      draw(reversed, N, BIN)
        .map(r => [r.x, r.x + r.w - 0.4] as const)
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
    // 6 bases, bin 4 => bin 1 covers only bp [1004,1006), half a bin.
    const rects = draw(false, 6, BIN)
    expect(rects).toHaveLength(2)
    expect(rects[1]!.w).toBeCloseTo(2 * PX_PER_BP + 0.4)
  })
})

// A gap run reaching either end of the block measures where the MAF was
// chunked, not the alignment, so those columns paint nothing at all — the same
// blank the sample gets in blocks it is absent from. Before this, one
// non-alignment read as a gap-colored box on the right of one block, a blank
// through the next, and another box on the left of the third.
describe('drawMafBlocks boundary gaps', () => {
  test('a trailing gap run paints no cells', () => {
    const rects = draw(false, 5, 1, 'AAA--')
    expect(rects).toHaveLength(3)
    expect(rects.map(r => r.x)).toEqual([0, PX_PER_BP, 2 * PX_PER_BP])
  })

  test('a leading gap run paints no cells', () => {
    const rects = draw(false, 5, 1, '--AAA')
    expect(rects).toHaveLength(3)
    expect(rects[0]!.x).toBeCloseTo(2 * PX_PER_BP)
  })

  test('an all-gap row paints nothing', () => {
    expect(draw(false, 5, 1, '-----')).toHaveLength(0)
  })

  test('an interior gap run still paints', () => {
    expect(draw(false, 5, 1, 'A--AA')).toHaveLength(5)
  })
})
