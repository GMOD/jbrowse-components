import * as readShader from '../shaders/slang/read.generated.ts'
import {
  READ_COLOR_CATEGORY,
  READ_COLOR_CATEGORY_BY_INDEX,
  readCategoryPaletteKeys,
  swatchPaletteKeys,
} from './colorUtils.ts'

// read.slang classifies nothing — `readColorCategory` (colorUtils.ts) decides a
// read's bucket once on the CPU and the shader paints the resulting RC_* index.
// What is left to check is the VOCABULARY: the shader's RC_* constants and this
// file's category indices have to be the same dense numbering, because the index
// travels between them as a byte in a vertex attribute.
//
// The category → COLOR mapping used to need checking too, and the check was a
// regex that re-read read.slang's source and matched its `cat == RC_X` arms
// against `swatchPaletteKeys`. That is gone in both directions: the shader has
// no arms left (it indexes `u.readCategoryColor`) and the CPU fills that array
// from `readCategoryPaletteKeys`, which `swatchPaletteKeys` is spread into. The
// legend and the GPU read one table, so there is nothing left for a test to
// reconcile — only that the table is total, which the type system now says.

// RC_NAME → index, from the shader's own exported constants. The module also
// exports shader source strings, hence the typeof narrowing.
const shaderCategoryIndex = new Map<string, number>()
for (const [name, value] of Object.entries<unknown>(readShader)) {
  if (name.startsWith('RC_') && typeof value === 'number') {
    shaderCategoryIndex.set(name, value)
  }
}

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

  // The uniform array is sized by a shader constant, and the CPU writes into it
  // by category index. One slot short and the last category's color is written
  // past the end of the field — into whatever uniform std140 put next, which is
  // a corrupted unrelated value, not a wrong color.
  test('the shader reserves a palette slot for every category', () => {
    expect(readShader.READ_CATEGORY_SLOTS).toBe(
      Object.keys(READ_COLOR_CATEGORY).length,
    )
  })

  // `satisfies Record<ReadColorCategory, …>` makes a missing entry a compile
  // error, so this only has to catch the reverse: a key that is no longer a
  // category would leave a slot unwritten and paint the previous render's color.
  test('every palette entry names a live category', () => {
    expect(Object.keys(readCategoryPaletteKeys).sort()).toEqual(
      Object.keys(READ_COLOR_CATEGORY).sort(),
    )
  })

  // The legend swatches through `swatchPaletteKeys`; the GPU paints through
  // `readCategoryPaletteKeys`. The second is built from the first, and this is
  // what says so — if someone overrides a swatch category in the spread, a
  // legend entry stops matching the reads it labels.
  test('the swatch categories keep their swatch color on the GPU', () => {
    for (const [category, key] of Object.entries(swatchPaletteKeys)) {
      expect(
        readCategoryPaletteKeys[category as keyof typeof swatchPaletteKeys],
      ).toBe(key)
    }
  })
})
