import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { abgrToCssRgba } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import { emptyMafCoverage } from '../LinearMafDisplay/components/coverageTestFixture.ts'
import {
  SOURCE_CHROM_PALETTE,
  encodeSourceChromSpans,
} from '../LinearMafDisplay/components/drawSourceChrom.ts'
import { EMPTY_MAF_CELLS } from './mafChannels.ts'
import { MAF_MARKS, MAF_SOURCE_CHROM_MARK } from './mafMarks.ts'

import type { MafBlock, MafGPURenderState } from './mafRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function recordingCtx() {
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] =
    []
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: `${this.fillStyle}` })
    },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    setLineDash() {},
    closePath() {},
    fill() {},
    strokeStyle: '',
    lineWidth: 1,
    strokeRect() {},
    stroke() {},
    scale() {},
    rotate() {},
  } satisfies MarkContext2D
  return { rects, ctx }
}

const ROW_HEIGHT = 10
const ROW_PROPORTION = 0.8
const ROWS_TOP = 30
const SCROLL_TOP = 4

const STATE = {
  canvasWidth: 200,
  canvasHeight: 130,
  rowsTop: ROWS_TOP,
  rowsHeight: 100,
  rowHeight: ROW_HEIGHT,
  rowProportion: ROW_PROPORTION,
  scrollTop: SCROLL_TOP,
} as MafGPURenderState

function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 1000,
    end: 2000,
    screenStartPx: 0,
    screenEndPx: 200,
    reversed,
  }
}

const bytes = new Uint8Array(0)

function mafBlock(
  startBp: number,
  endBp: number,
  rows: [number, string | undefined][],
): MafBlock {
  return {
    startBp,
    endBp,
    refSeqBytes: bytes,
    empties: [],
    rows: rows.map(([rowIndex, chr]) => ({
      rowIndex,
      chr,
      alignmentBytes: bytes,
    })),
  }
}

const RANKS = new Map([
  [0, new Map([['chrI', 0]])],
  [
    2,
    new Map([
      ['chrI', 0],
      ['chrX', 1],
      ['chrV', 7],
    ]),
  ],
])

function paint(blocks: MafBlock[], reversed = false) {
  const { ctx, rects } = recordingCtx()
  MAF_SOURCE_CHROM_MARK.paintBlock(
    ctx,
    {
      cells: EMPTY_MAF_CELLS,
      sourceChrom: encodeSourceChromSpans(blocks, RANKS),
    },
    block(reversed),
    STATE,
  )
  return rects
}

const bandTop = (row: number) =>
  ROWS_TOP +
  rowBandOffsetPx(ROW_HEIGHT, ROW_PROPORTION) +
  ROW_HEIGHT * row -
  SCROLL_TOP

const BAND_HEIGHT = drawnRowHeightPx(ROW_HEIGHT, ROW_PROPORTION)

// The CSS conversion of each `SOURCE_CHROM_PALETTE` entry, which is what a
// canvas handed the hsl() string painted.
const RANK_RGBA = [
  'rgba(77,140,203,1)',
  'rgba(238,134,43,1)',
  'rgba(222,69,94,1)',
  'rgba(156,100,196,1)',
  'rgba(59,155,107,1)',
]

describe('color by source chromosome, as a span mark', () => {
  test('paints each aligned row across its block, in the row band, in its rank color', () => {
    expect(
      paint([
        mafBlock(1100, 1150, [
          [0, 'chrI'],
          [2, 'chrX'],
        ]),
      ]),
    ).toEqual([
      { x: 20, y: bandTop(0), w: 10, h: BAND_HEIGHT, fill: RANK_RGBA[0] },
      { x: 20, y: bandTop(2), w: 10, h: BAND_HEIGHT, fill: RANK_RGBA[1] },
    ])
  })

  test('a rank past the palette takes its last entry, and a row with no chr draws nothing', () => {
    const { color, row } = encodeSourceChromSpans(
      [
        mafBlock(1100, 1150, [
          [0, 'chrI'],
          [1, undefined],
          [2, 'chrV'],
        ]),
      ],
      RANKS,
    )
    expect([...row]).toEqual([0, 2])
    expect([...color].map(abgrToCssRgba)).toEqual([RANK_RGBA[0], RANK_RGBA[4]])
  })

  test('each palette entry packs to its CSS conversion', () => {
    const { color } = encodeSourceChromSpans(
      [
        mafBlock(
          0,
          1,
          SOURCE_CHROM_PALETTE.map((_, r) => [r, 'c']),
        ),
      ],
      new Map(SOURCE_CHROM_PALETTE.map((_, r) => [r, new Map([['c', r]])])),
    )
    expect([...color].map(abgrToCssRgba)).toEqual(RANK_RGBA)
  })

  test('a block narrower than a pixel still paints one', () => {
    expect(paint([mafBlock(1100, 1101, [[0, 'chrI']])])).toMatchObject([
      { x: 20, w: 1 },
    ])
  })

  test('on a reversed region the floored block grows away from its start', () => {
    expect(paint([mafBlock(1100, 1101, [[0, 'chrI']])], true)).toMatchObject([
      { x: 179, w: 1 },
    ])
  })

  test('the GPU draws it off its own buffer, after the cells, in the rows band', () => {
    const hal = new MockHal(MAF_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, MAF_MARKS)
    const payload = {
      cells: EMPTY_MAF_CELLS,
      sourceChrom: encodeSourceChromSpans(
        [mafBlock(1100, 1150, [[0, 'chrI']])],
        RANKS,
      ),
      coverage: emptyMafCoverage(),
    }
    backend.upload(0, payload)
    backend.renderBlocks([block(false)], new Map([[0, payload]]), {
      ...STATE,
      coverage: { height: 0 },
    } as MafGPURenderState)
    const draws = hal.draws()
    expect(draws.map(d => d.passId)).toEqual(['span', 'mafSourceChrom'])
    const dpr = getDpr()
    expect(draws[1]!.scissor).toEqual({
      x: 0,
      y: ROWS_TOP * dpr,
      w: 200 * dpr,
      h: 100 * dpr,
    })
  })
})
