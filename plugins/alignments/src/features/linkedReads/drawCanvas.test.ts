import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
import { LINKED_READ_LINE_ALPHA } from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import { LINKED_READ_LINE_MARK } from './mark.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Real distinguishable colors, so "which slot did it read" is answerable from
// the stroke string. makeTestPalette's default is all-zero, where every slot
// resolves to the same CSS and a wrong index is invisible.
const ARC_COLORED = [
  'normalInsert',
  'pairLR',
  'longInsert',
  'shortInsert',
  'interchrom',
  'pairLL',
  'pairRR',
  'pairRL',
  'splitSameStrand',
] as const
const STOCK = makeTestPalette({
  readCategoryColors: Object.fromEntries(
    ARC_COLORED.map((category, i) => [category, [i / 10, 0.5, 1 - i / 10]]),
  ),
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

const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 1400,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

function state(): RenderState {
  return {
    scrollTop: 0,
    featureHeight: 10,
    featureSpacing: 0,
    canvasHeight: 1000,
    pileupTopOffset: 0,
    showConnectors: true,
    colors: STOCK,
  } as RenderState
}

function oneLine(colorType: number): LinkedReadLinesUploadData {
  return {
    linkedReadLinePositions: new Uint32Array([1050, 1150]),
    linkedReadLineYs: new Uint16Array([0, 0]),
    linkedReadLineColorTypes: new Uint16Array([colorType]),
    numLinkedReadLines: 1,
  }
}

function strokeFor(colorType: number) {
  const { ctx, strokes } = recordingCtx()
  LINKED_READ_LINE_MARK.paintBlock(ctx, oneLine(colorType), BLOCK, {
    ...state(),
  })
  return strokes[0]!
}

const expectedStroke = (slot: number) =>
  rgba255(buildArcColorPalette(STOCK)[slot]!, LINKED_READ_LINE_ALPHA)

// The palette-index rule is `linkedReadColorSlot` (a CLAMP, generated from
// alignmentsUniforms.slang). This pass once spelled it
// `colorType % css.length` — a WRAP, which for an out-of-range slot resolves
// to a different REAL color rather than to the last one.
describe('linked-read connector strokes follow the generated slot rule', () => {
  it('paints the arc slot its color type names', () => {
    buildArcColorPalette(STOCK).forEach((_, slot) => {
      expect(strokeFor(slot)).toBe(expectedStroke(slot))
    })
  })

  it('clamps a slot past the palette to the last slot, never wrapping', () => {
    const last = buildArcColorPalette(STOCK).length - 1
    for (const past of [last + 1, 15]) {
      expect(strokeFor(past)).toBe(expectedStroke(last))
    }
  })
})
