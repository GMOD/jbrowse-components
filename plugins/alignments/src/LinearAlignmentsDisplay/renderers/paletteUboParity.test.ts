import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_SLOT_KEYS, LINKED_READ_SLOT_KEYS } from '../../shaders/palettes.ts'
import {
  UNIFORM_OFFSET_U32,
  UNIFORM_SLOT_ARRAYS,
} from '../../shaders/slang/read.iface.generated.ts'
import { READ_COLOR_CATEGORY, readCategoryPaletteKeys } from '../colorUtils.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
  PALETTE_UNIFORM_FIELDS,
} from './GpuAlignmentsRenderer.ts'

import type { ColorPalette, RGBColor } from '../../shaders/colors.ts'
import type { AlignmentsSources } from './rendererTypes.ts'

/**
 * Four tables project a `ColorPalette` onto uniform slots — the named colors, the
 * arc palette, the linked-read palette, and the read categories — and the walks
 * over them are now PRE-RESOLVED at module load into parallel index/key arrays,
 * because they ran per frame per region per track.
 *
 * That trades an `Object.entries` per call for an alignment invariant: slot `i`
 * and key `i` have to still describe the same table entry. Nothing about a
 * misalignment is loud. It writes a real color into a real slot, so the render
 * succeeds and every read of one category paints another's color — which is what
 * `baseColorParity.test.ts` pins for the five base slots and nothing pinned for
 * the other fifty.
 *
 * So the assertion is per SLOT, driven off the source tables rather than off the
 * derived ones: a new palette entry is covered the day it is added, and a table
 * whose traversal drifts fails here rather than in a figure.
 */

// One distinct color per palette key, so a transposition cannot pass by two
// slots happening to agree. Spread over the 8-bit quantization `packRgb` applies
// (`normalizedRgbToABGR`) rather than over the float range, so each really does
// pack to a different u32.
function distinctPalette() {
  const overrides: Record<string, RGBColor> = {}
  const keys = Object.keys(makeTestPalette()) as (keyof ColorPalette)[]
  for (let i = 0; i < keys.length; i++) {
    overrides[keys[i]!] = [(i + 1) / 255, ((i + 1) * 2) / 255, 0.5]
  }
  return makeTestPalette(overrides)
}

const COLORS = distinctPalette()

// The uniforms one block of one empty region leaves behind. showModifications
// false, so `effectiveBaseColors` passes the five base colors through unmuted.
function lastUniforms() {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  const sources: AlignmentsSources = {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
  renderer.upload('sources', sources)
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 200,
        reversed: false,
      },
    ],
    makeTestRenderState({ showModifications: false, colors: COLORS }),
  )
  return { u32: hal.getLastUniformsU32()!, f32: hal.getLastUniformsF32()! }
}

const { u32, f32 } = lastUniforms()

const packed = (key: keyof ColorPalette) => {
  const rgb = COLORS[key]
  return normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
}

describe('the named palette uniforms', () => {
  test.each(Object.entries(PALETTE_UNIFORM_FIELDS))(
    '%s holds the packed color of %s',
    (uniform, key) => {
      expect(
        u32[UNIFORM_OFFSET_U32[uniform as keyof typeof UNIFORM_OFFSET_U32]],
      ).toBe(packed(key))
    },
  )

  // Guards the guard: the loop above proves nothing if the palette it ran
  // against holds one color repeated.
  test('every named slot is a distinct color, so a transposition would show', () => {
    const slots = Object.keys(PALETTE_UNIFORM_FIELDS).map(
      u => u32[UNIFORM_OFFSET_U32[u as keyof typeof UNIFORM_OFFSET_U32]],
    )
    expect(new Set(slots).size).toBe(slots.length)
  })
})

// The three indexed palettes are `float4[]`, so their slots live in the f32 view
// and carry the normalized components with alpha 1 — not the packed u32 above.
function f32Slot(offset: number) {
  return [f32[offset], f32[offset + 1], f32[offset + 2], f32[offset + 3]]
}

// Through a Float32Array, because the slot is one: the palette carries doubles
// and comparing them raw fails on rounding rather than on a transposition.
function expectedSlot(key: keyof ColorPalette) {
  const rgb = COLORS[key]
  return [...Float32Array.of(rgb[0], rgb[1], rgb[2], 1)]
}

describe('the indexed palette uniforms', () => {
  test.each(UNIFORM_SLOT_ARRAYS.arcColor.map((o, i) => [i, o]))(
    'arcColor slot %i holds its category color',
    (i, offset) => {
      expect(f32Slot(offset)).toEqual(expectedSlot(ARC_SLOT_KEYS[i]!))
    },
  )

  test.each(UNIFORM_SLOT_ARRAYS.linkedReadColor.map((o, i) => [i, o]))(
    'linkedReadColor slot %i holds its category color',
    (i, offset) => {
      expect(f32Slot(offset)).toEqual(expectedSlot(LINKED_READ_SLOT_KEYS[i]!))
    },
  )

  // Driven off `readCategoryPaletteKeys` rather than off the slot array, since
  // the categories index the array by name through READ_COLOR_CATEGORY — the
  // mapping the pre-resolved walk flattened.
  test.each(Object.entries(readCategoryPaletteKeys))(
    'read category %s holds the packed color of %s',
    (category, key) => {
      const slot =
        UNIFORM_SLOT_ARRAYS.readCategoryColor[
          READ_COLOR_CATEGORY[category as keyof typeof READ_COLOR_CATEGORY]
        ]!
      expect(f32Slot(slot)).toEqual(expectedSlot(key))
    },
  )
})
