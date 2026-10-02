import { MockHal } from '@jbrowse/render-core/hal'
import { defineMark } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  recordingContext,
  sweepMarkAgainstHit,
} from '@jbrowse/render-core/marks/drawAgainstHit'

import { encodeSequenceCells } from './sequenceCells.ts'
import { rowLayout, seqColor } from './sequenceGeometry.ts'
import {
  BASE_MARK,
  CODON_MARK,
  SEQUENCE_MARKS,
  cellParams,
  sequenceCellShape,
} from './sequenceMarks.ts'
import { UNIFORM_OFFSET_U32 } from './shaders/sequenceCell.iface.generated.ts'

import type { SequenceRegionData } from '../model.ts'
import type { SequenceCellChannels } from './sequenceCells.ts'
import type { ColorPalette } from './sequenceGeometry.ts'
import type { SequenceMarkState } from './sequenceMarks.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200
const PX_PER_BP = BLOCK_WIDTH / (END - START)

function color(fill = 'rgb(0,128,0)') {
  return seqColor(fill, '#000')
}

const palette: ColorPalette = {
  bases: new Map([
    ['A', color('rgb(0,200,0)')],
    ['C', color('rgb(0,0,200)')],
    ['G', color('rgb(200,200,0)')],
    ['T', color('rgb(200,0,0)')],
  ]),
  frames: new Map(),
  start: color('rgb(0,255,0)'),
  stop: color('rgb(255,0,0)'),
  fallback: color('rgb(170,170,170)'),
}

const data: SequenceRegionData = {
  seq: 'ACGTACGTAC',
  start: START,
  geneticCodeId: 1,
}

function encode(reversed: boolean, showTranslation = false) {
  return encodeSequenceCells(
    data,
    {
      showForward: true,
      showReverse: true,
      showTranslation,
      isDna: true,
      palette,
    },
    reversed,
  )
}

const state: SequenceMarkState = {
  rowHeight: 10,
  showLetters: true,
  canvasWidth: BLOCK_WIDTH,
  canvasHeight: 80,
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

function sliceOne(c: SequenceCellChannels, i: number): SequenceCellChannels {
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    row: c.row.subarray(i, i + 1),
    color: c.color.subarray(i, i + 1),
    bordered: c.bordered.subarray(i, i + 1),
    count: 1,
  }
}

const CELL_MARK = defineMark({
  shape: sequenceCellShape,
  channels: (c: SequenceCellChannels) => c,
  params: cellParams,
})

function cellCenter(c: SequenceCellChannels, i: number, reversed: boolean) {
  const ink = CELL_MARK.ink!(c, block(reversed), state, i)!
  return [ink.left + ink.width / 2, ink.top + ink.height / 2] as const
}

describe('the sequence display mark list', () => {
  test('declares a base mark and a codon mark, each on its own pass', () => {
    expect(SEQUENCE_MARKS).toEqual([BASE_MARK, CODON_MARK])
    expect(SEQUENCE_MARKS.map(m => m.pass.id)).toEqual([
      'sequenceBase',
      'sequenceCodon',
    ])
    for (const m of SEQUENCE_MARKS) {
      expect(m.pass.source.wgsl).toBeDefined()
      expect(m.pass.source.glsl).toBeDefined()
    }
  })

  test('the GPU backend draws both passes from one upload', () => {
    const hal = new MockHal(SEQUENCE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, SEQUENCE_MARKS)
    const regions = new Map([[0, encode(false, true)]])
    backend.upload(0, regions.get(0)!)
    expect(backend.renderBlocks([block(false)], regions, state)).toBe(true)
    expect(hal.draws().map(d => d.passId)).toEqual([
      'sequenceBase',
      'sequenceCodon',
    ])
    expect(hal.getLastUniformsU32()![UNIFORM_OFFSET_U32.showBorders]).toBe(1)
  })
})

describe('sequence cell hit test', () => {
  test.each([false, true])(
    'answers the base under the cursor (reversed: %s)',
    reversed => {
      const regions = encode(reversed)
      const { bases } = regions
      const all = Array.from({ length: bases.count }, (_, i) => i)
      for (let i = 0; i < bases.count; i++) {
        const [x, y] = cellCenter(bases, i, reversed)
        const hit = BASE_MARK.hitNearest!(
          regions,
          block(reversed),
          state,
          x,
          y,
          all,
          1,
        )
        expect(hit?.index).toBe(i)
        expect(bases.x[hit!.index]).toBe(bases.x[i])
      }
    },
  )

  test('the cell at the left edge is START forward and END-1 reversed', () => {
    for (const reversed of [false, true]) {
      const regions = encode(reversed)
      const all = Array.from({ length: regions.bases.count }, (_, i) => i)
      const hit = BASE_MARK.hitNearest!(
        regions,
        block(reversed),
        state,
        PX_PER_BP / 2,
        state.rowHeight / 2,
        all,
        1,
      )!
      expect(regions.bases.x[hit.index]).toBe(reversed ? END - 1 : START)
    }
  })

  test.each(['bases', 'codons'] as const)(
    'every %s cell paints inside its own ink and the hit test agrees',
    rows => {
      for (const reversed of [false, true]) {
        expect(
          sweepMarkAgainstHit(
            CELL_MARK,
            encode(reversed, true)[rows],
            block(reversed),
            state,
            { sliceOne },
          ),
        ).toEqual([])
      }
    },
  )
})

describe('sequence cell geometry on a reversed block', () => {
  const unbordered = { ...state, showLetters: false }

  // within half a pixel: the ink carries the painter's seam, and a one-base
  // error is 20px
  function leftOf(
    channels: SequenceCellChannels,
    i: number,
    reversed: boolean,
  ) {
    return CELL_MARK.ink!(channels, block(reversed), unbordered, i)!.left
  }

  test('the base at START sits at the low edge forward, the high edge reversed', () => {
    const at = (reversed: boolean) =>
      leftOf(encode(reversed).bases, 0, reversed)
    expect(at(false)).toBeCloseTo(0, 0)
    expect(at(true)).toBeCloseTo(BLOCK_WIDTH - PX_PER_BP, 0)
  })

  // START % 3 === 1, so frame +1's grid starts 2 bases in: the first whole
  // codon is [START+2, START+5), and reversed its leftmost edge is its end.
  test('a codon is anchored at its end on a reversed block', () => {
    for (const reversed of [false, true]) {
      const { codons } = encode(reversed, true)
      const s = { showForward: true, showReverse: true, showTranslation: true }
      const slot = rowLayout(s, reversed).findIndex(
        r => r.type === 'translation' && r.frame === 1,
      )
      const i = [...codons.x].findIndex(
        (x, k) => codons.row[k] === slot && x === START + 2,
      )
      expect(leftOf(codons, i, reversed)).toBeCloseTo(
        reversed ? BLOCK_WIDTH - 5 * PX_PER_BP : 2 * PX_PER_BP,
        0,
      )
    }
  })

  test('the painter fills a run of same-coloured cells as one rect', () => {
    const { ctx, calls } = recordingContext()
    const cells = encodeSequenceCells(
      { seq: 'AAAC', start: START, geneticCodeId: 1 },
      {
        showForward: true,
        showReverse: false,
        showTranslation: false,
        isDna: true,
        palette,
      },
      true,
    )
    CELL_MARK.paintBlock(ctx, cells.bases, block(true), unbordered)
    expect(calls.map(r => [r.x, r.w])).toEqual([
      [BLOCK_WIDTH - 3 * PX_PER_BP - 0.4, 3 * PX_PER_BP + 0.4],
      [BLOCK_WIDTH - 4 * PX_PER_BP - 0.4, PX_PER_BP + 0.4],
    ])
  })
})
