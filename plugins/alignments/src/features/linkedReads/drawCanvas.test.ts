import {
  colorPairLL,
  colorPairLR,
  colorPairRL,
  colorPairRR,
  colorSplitReadInversion,
  colorSupplementary,
} from '@jbrowse/core/ui/palette'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { LINKED_READ_LINE_ALPHA } from '../../shaders/slang/linkedReadLine.iface.generated.ts'
import { drawLinkedReadLines } from './drawCanvas.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Real distinguishable colors, so "which slot did it read" is answerable from
// the stroke string. makeTestPalette's default is all-zero, where every slot
// resolves to the same CSS and a wrong index is invisible.
const STOCK = makeTestPalette({
  colorPairLR: cssColorToNormalizedRgb(colorPairLR),
  colorPairRL: cssColorToNormalizedRgb(colorPairRL),
  colorPairRR: cssColorToNormalizedRgb(colorPairRR),
  colorPairLL: cssColorToNormalizedRgb(colorPairLL),
  colorSupplementary: cssColorToNormalizedRgb(colorSupplementary),
  colorSplitInversion: cssColorToNormalizedRgb(colorSplitReadInversion),
})

function recordingCtx() {
  const strokes: string[] = []
  let current = ''
  const ctx = {
    set strokeStyle(v: string) {
      current = v
    },
    get strokeStyle() {
      return current
    },
    set lineWidth(_v: number) {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {
      strokes.push(current)
    },
  } as unknown as Ctx2D
  return { ctx, strokes }
}

const BLOCK: DrawBlock = { start: 1000, end: 1400, screenStartPx: 0 }

function state(): RenderState {
  return {
    scrollTop: 0,
    featureHeight: 10,
    featureSpacing: 0,
    canvasHeight: 1000,
    pileupTopOffset: 0,
    colors: STOCK,
  } as RenderState
}

function oneLine(colorType: number): LinkedReadLinesUploadData {
  return {
    linkedReadLinePositions: new Uint32Array([1050, 1150]),
    linkedReadLineYs: new Uint16Array([0, 0]),
    linkedReadLineColorTypes: new Uint8Array([colorType]),
    numLinkedReadLines: 1,
  }
}

function strokeFor(colorType: number) {
  const { ctx, strokes } = recordingCtx()
  drawLinkedReadLines(ctx, oneLine(colorType), BLOCK, 400, 100, state())
  return strokes[0]!
}

const expectedStroke = (slot: number) =>
  rgba255(buildLinkedReadColorPalette(STOCK)[slot]!, LINKED_READ_LINE_ALPHA)

// The palette-index rule is `linkedReadColorSlot` (a CLAMP, generated from
// alignmentsUniforms.slang). This pass spelled it `colorType % css.length` — a
// WRAP, which agrees with the clamp on every slot in use and so survives review,
// and which for an out-of-range slot resolves to a different REAL color rather
// than to the last one. The rule's own unit test (arcYScale.test.ts) could not
// catch this, because what drifted was the call site, not the rule; the bezier
// overlay and the arc pass had already been moved onto it and this one had not.
describe('linked-read connector strokes follow the generated slot rule', () => {
  it('reads the slot the color type names, for every slot in the palette', () => {
    buildLinkedReadColorPalette(STOCK).forEach((_, slot) => {
      expect(strokeFor(slot)).toBe(expectedStroke(slot))
    })
  })

  it('clamps an out-of-range color type to the last slot, never wrapping', () => {
    const palette = buildLinkedReadColorPalette(STOCK)
    const last = palette.length - 1
    for (const past of [palette.length, palette.length + 2, 99]) {
      expect(strokeFor(past)).toBe(expectedStroke(last))
      // The same rule the GPU and the SVG overlay index through.
      expect(strokeFor(past)).toBe(expectedStroke(linkedReadColorSlot(past)))
    }
  })

  // Where the wrap and the clamp actually part company, which is NOT at the
  // first out-of-range index: slot 7 is the unknown/fallback baseline and takes
  // LR's swatch, the same one slot 0 takes, so `8 % 8 === 0` happened to paint
  // the clamp's color. Slots 1 and 9 are LR too. Index 10 is the first that
  // wraps onto a slot with a color of its own (2, pairRL) — so this is the
  // assertion the palette's own shape leaves available to distinguish the two.
  it('paints slot 10 the fallback, not the RL it would wrap onto', () => {
    const palette = buildLinkedReadColorPalette(STOCK)
    expect(expectedStroke(10 % palette.length)).not.toBe(
      expectedStroke(palette.length - 1),
    )
    expect(strokeFor(10)).toBe(expectedStroke(palette.length - 1))
  })
})
