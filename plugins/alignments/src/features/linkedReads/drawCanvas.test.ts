import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { buildArcColorPalette } from '../../shaders/palettes.ts'
import { LINKED_READ_LINE_ALPHA } from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import { ARC_COLOR_FIELDS } from '../../shared/arcColorOptions.ts'
import { connectorColorType } from '../arcs/arcColors.ts'
import { LINKED_READ_LINE_MARK } from './mark.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ArcColorField } from '../../shared/types.ts'
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
  'splitDeletion',
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
    showLinkedReadLines: true,
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

function strokeFor(colorType: number, field: ArcColorField) {
  const { ctx, strokes } = recordingCtx()
  LINKED_READ_LINE_MARK.paintBlock(ctx, oneLine(colorType), BLOCK, {
    ...state(),
    readConnectionsColorField: field,
  })
  return strokes[0]!
}

const expectedStroke = (field: ArcColorField, slot: number) =>
  rgba255(buildArcColorPalette(STOCK, field)[slot]!, LINKED_READ_LINE_ALPHA)

// The palette-index rule is `linkedReadColorSlot` (a CLAMP, generated from
// alignmentsUniforms.slang), which reads the field's slot out of the packed
// color type. This pass once spelled it `colorType % css.length` — a WRAP,
// which for an out-of-range slot resolves to a different REAL color rather
// than to the last one.
describe('linked-read connector strokes follow the generated slot rule', () => {
  it.each(ARC_COLOR_FIELDS)(
    'under %s, paints the arc slot packed for that field',
    field => {
      buildArcColorPalette(STOCK, field).forEach((_, slot) => {
        expect(
          strokeFor(
            connectorColorType(() => slot),
            field,
          ),
        ).toBe(expectedStroke(field, slot))
      })
    },
  )

  it('reads only the field it paints', () => {
    const colorType = connectorColorType(field =>
      field === 'pairOrientation' ? 6 : 1,
    )
    expect(strokeFor(colorType, 'pairOrientation')).toBe(
      expectedStroke('pairOrientation', 6),
    )
    expect(strokeFor(colorType, 'insertSize')).toBe(
      expectedStroke('insertSize', 1),
    )
  })

  it('clamps a slot past the palette to the last slot, never wrapping', () => {
    const field = 'insertSizeAndOrientation'
    const last = buildArcColorPalette(STOCK, field).length - 1
    for (const past of [last + 1, 15]) {
      expect(
        strokeFor(
          connectorColorType(() => past),
          field,
        ),
      ).toBe(expectedStroke(field, last))
    }
  })
})
