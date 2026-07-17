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

// One MAF block: a single reference base 'A' at START, with one aligned row
// whose base matches. Exactly one cell should be painted.
function regionData(): MafRegionData {
  return {
    blocks: [
      {
        startBp: START,
        endBp: START + 1,
        refSeqBytes: new Uint8Array([A]),
        rows: [{ rowIndex: 0, alignmentBytes: new Uint8Array([A]) }],
        empties: [],
      },
    ],
  } as unknown as MafRegionData
}

function state(): MafGPURenderState {
  return {
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 100,
    rowHeight: 10,
    rowProportion: 1,
    // showAllLetters so a matching base still paints a cell (resolveCellColor
    // returns undefined for matches in mismatch-only mode, painting nothing).
    showAllLetters: true,
    mismatchRendering: false,
    palette: {
      baseA: 'green',
      baseC: 'blue',
      baseG: 'orange',
      baseT: 'red',
      baseN: 'grey',
      match: 'lightgrey',
      gap: 'white',
      mismatch: 'black',
      unknown: 'grey',
      insertion: 'purple',
    },
  } as unknown as MafGPURenderState
}

function cellFor(reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
  drawMafBlocks(ctx, new Map([[0, regionData()]]), [block], state())
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
