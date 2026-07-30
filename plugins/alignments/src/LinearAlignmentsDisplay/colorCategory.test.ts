import { readFileSync } from 'fs'
import { join } from 'path'

import {
  READ_COLOR_CATEGORY,
  READ_COLOR_CATEGORY_BY_INDEX,
  swatchPaletteKeys,
} from './colorUtils.ts'
import { PALETTE_UNIFORM_FIELDS } from './renderers/GpuAlignmentsRenderer.ts'
import * as readShader from './shaders/slang/read.generated.ts'

import type { ColorPalette } from './shaders/colors.ts'

// read.slang classifies nothing — `readColorCategory` (colorUtils.ts) decides a
// read's bucket once on the CPU and the shader paints the resulting RC_* index.
// That kills the old drift risk (an ordered precedence chain spelled twice) but
// leaves two flat contracts, and these pin both:
//
//   1. the category VOCABULARY — RC_* in the shader vs ReadColorCategory here
//   2. the category → COLOR mapping — the shader's `categoryPaletteColor`
//      lookup vs `swatchPaletteKeys`, which is what the legend swatches
//
// Both are order-insensitive data, so a mismatch is a missing or extra entry,
// not a subtly reordered rule — the kind of thing a test can actually catch.

const slang = readFileSync(join(__dirname, 'shaders/slang/read.slang'), 'utf8')

// RC_NAME → index, from the shader's own exported constants. The module also
// exports shader source strings, hence the typeof narrowing.
const shaderCategoryIndex = new Map<string, number>()
for (const [name, value] of Object.entries<unknown>(readShader)) {
  if (name.startsWith('RC_') && typeof value === 'number') {
    shaderCategoryIndex.set(name, value)
  }
}

// index → RC_NAME
const shaderCategoryName = new Map(
  [...shaderCategoryIndex].map(([name, idx]) => [idx, name]),
)

// `if (cat == RC_X) { return unpackRGBA(u.someUniform).xyz; }` → RC_X:someUniform
const paletteArms = new Map(
  [
    ...slang
      .slice(
        slang.indexOf('float3 categoryPaletteColor'),
        slang.indexOf('float3 insertSizeGradientColor'),
      )
      .matchAll(/cat == (RC_\w+)\)\s*\{ return unpackRGBA\(u\.(\w+)\)/g),
  ].map(m => [m[1]!, m[2]!]),
)

// Covered by the shader's trailing `return unpackRGBA(u.colorPairLR)` rather
// than an explicit arm; the two dynamic categories never reach the table.
const FALLTHROUGH = ['RC_PLAIN', 'RC_NORMAL_INSERT', 'RC_NO_TAG_VALUE']
const DYNAMIC = ['RC_MAPQ', 'RC_TAG']
const FALLTHROUGH_KEY: keyof ColorPalette = 'colorPairLR'

describe('read color categories', () => {
  test('the shader and TS agree on the category vocabulary', () => {
    expect(Object.values(READ_COLOR_CATEGORY).sort((a, b) => a - b)).toEqual(
      [...shaderCategoryIndex.values()].sort((a, b) => a - b),
    )
  })

  test('indices are dense and unique, so the uploaded byte round-trips', () => {
    const indices = Object.values(READ_COLOR_CATEGORY)
    expect(new Set(indices).size).toBe(indices.length)
    expect(Math.min(...indices)).toBe(0)
    expect(Math.max(...indices)).toBe(indices.length - 1)
    // The reverse map turns a baked byte back into a category, for the Canvas2D
    // fill and the legend's bucket scan.
    for (const [name, idx] of Object.entries(READ_COLOR_CATEGORY)) {
      expect(READ_COLOR_CATEGORY_BY_INDEX[idx]).toBe(name)
    }
  })

  test('every category is painted by the shader', () => {
    expect(
      [...shaderCategoryIndex.keys()].filter(
        rc =>
          !paletteArms.has(rc) &&
          !FALLTHROUGH.includes(rc) &&
          !DYNAMIC.includes(rc),
      ),
    ).toEqual([])
  })

  // The strongest of the three: composes shader arm → uniform → palette key and
  // compares it against the key the legend swatches. Catches a category painted
  // one color on the GPU and labelled another in the legend.
  test('the shader paints each category the color the legend swatches', () => {
    const mismatches: string[] = []
    for (const [category, paletteKey] of Object.entries(swatchPaletteKeys)) {
      const idx =
        READ_COLOR_CATEGORY[category as keyof typeof swatchPaletteKeys]
      const uniform = paletteArms.get(shaderCategoryName.get(idx) ?? '')
      // A swatch category with no explicit arm rides the colorPairLR
      // fallthrough, which is only correct if that IS its palette key.
      const shaderKey =
        uniform === undefined
          ? FALLTHROUGH_KEY
          : PALETTE_UNIFORM_FIELDS[
              uniform as keyof typeof PALETTE_UNIFORM_FIELDS
            ]
      if (shaderKey !== paletteKey) {
        mismatches.push(`${category}: shader=${shaderKey} legend=${paletteKey}`)
      }
    }
    expect(mismatches).toEqual([])
  })
})
