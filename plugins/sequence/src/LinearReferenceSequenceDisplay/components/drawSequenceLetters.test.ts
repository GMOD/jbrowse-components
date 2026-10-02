import { drawSequenceLetters } from './drawSequenceLetters.ts'
import { rowLayout, seqColor } from './sequenceGeometry.ts'

import type { SequenceRegionData } from '../model.ts'
import type { ColorPalette, SequenceRenderState } from './sequenceGeometry.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const START = 1000
const END = 1010
const BLOCK_WIDTH = 200
const PX_PER_BP = BLOCK_WIDTH / (END - START)

function recordingCtx() {
  const texts: { text: string; x: number; y: number }[] = []
  return {
    texts,
    ctx: {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText(text: string, x: number, y: number) {
        texts.push({ text, x, y })
      },
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
    } as unknown as Ctx2D,
  }
}

function color() {
  return seqColor('rgb(0,128,0)', '#000')
}

const palette: ColorPalette = {
  bases: new Map([['A', color()]]),
  frames: new Map(),
  start: color(),
  stop: color(),
  fallback: color(),
}

const data: SequenceRegionData = {
  seq: 'AAAAAAAAAC',
  start: START,
  geneticCodeId: 1,
}

function state(overrides?: Partial<SequenceRenderState>): SequenceRenderState {
  return {
    showLetters: true,
    showForward: true,
    showReverse: false,
    showTranslation: false,
    isDna: true,
    rowHeight: 10,
    palette,
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

function lettersFor(reversed: boolean, s = state()) {
  const { ctx, texts } = recordingCtx()
  drawSequenceLetters(ctx, new Map([[0, data]]), [block(reversed)], s)
  return texts
}

test('paints no letters while bases are too narrow to read', () => {
  expect(lettersFor(false, state({ showLetters: false }))).toEqual([])
})

test('centres each base letter in its cell', () => {
  const texts = lettersFor(false)
  expect(texts).toHaveLength(END - START)
  expect(texts[0]).toEqual({ text: 'A', x: PX_PER_BP / 2, y: 5 })
  expect(texts.at(-1)).toEqual({
    text: 'C',
    x: BLOCK_WIDTH - PX_PER_BP / 2,
    y: 5,
  })
})

test('a reversed block mirrors the letters and complements the top row', () => {
  const texts = lettersFor(true)
  expect(texts[0]).toEqual({ text: 'T', x: BLOCK_WIDTH - PX_PER_BP / 2, y: 5 })
  expect(texts.at(-1)).toEqual({ text: 'G', x: PX_PER_BP / 2, y: 5 })
})

test('a reversed block paints a peptide’s residues as they are', () => {
  const texts = lettersFor(true, state({ isDna: false }))
  expect(texts[0]?.text).toBe('A')
  expect(texts.at(-1)?.text).toBe('C')
})

// START % 3 === 1, so frame +1's first whole codon is [START+2, START+5),
// which reads AAA, lysine.
test('centres each amino acid over its codon on both orientations', () => {
  for (const reversed of [false, true]) {
    const s = state({ showTranslation: true })
    const slot = rowLayout(s, reversed).findIndex(
      r => r.type === 'translation' && r.frame === 1,
    )
    const y = slot * s.rowHeight + s.rowHeight / 2
    const row = lettersFor(reversed, s).filter(t => t.y === y)
    const mid = 3.5 * PX_PER_BP
    expect(row[0]).toEqual({
      text: 'K',
      x: reversed ? BLOCK_WIDTH - mid : mid,
      y,
    })
  }
})
