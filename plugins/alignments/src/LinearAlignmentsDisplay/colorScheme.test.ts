import { orientationSchemes } from './colorUtils.ts'
import { ColorScheme } from './model.ts'
import {
  CS_FIRST_OF_PAIR,
  CS_INSERT_SIZE,
  CS_IS_AND_ORIENT,
  CS_IS_GRADIENT,
  CS_MAPQ,
  CS_MODIFICATIONS,
  CS_NORMAL,
  CS_ORIENTATION_MASK,
  CS_PAIR_ORIENT,
  CS_STRAND,
  CS_TAG,
} from './shaders/slang/read.generated.ts'

describe('ColorScheme', () => {
  test('has all expected color scheme indices', () => {
    expect(ColorScheme.normal).toBe(0)
    expect(ColorScheme.strand).toBe(1)
    expect(ColorScheme.mappingQuality).toBe(2)
    expect(ColorScheme.insertSize).toBe(3)
    expect(ColorScheme.firstOfPairStrand).toBe(4)
    expect(ColorScheme.pairOrientation).toBe(5)
    expect(ColorScheme.insertSizeAndOrientation).toBe(6)
    expect(ColorScheme.modifications).toBe(7)
    expect(ColorScheme.tag).toBe(8)
    expect(ColorScheme.insertSizeGradient).toBe(9)
  })

  test('all indices are unique', () => {
    const values = Object.values(ColorScheme)
    expect(new Set(values).size).toBe(values.length)
  })

  // Guards the codegen wiring: ColorScheme is built from read.slang's exported
  // CS_* constants (read.generated.ts). A stale regen or manual edit that
  // decoupled them would make the shader switch and the JS/Canvas2D path
  // silently disagree on indices — this catches it.
  test('matches the shader-generated CS_* constants', () => {
    expect(ColorScheme).toEqual({
      normal: CS_NORMAL,
      strand: CS_STRAND,
      mappingQuality: CS_MAPQ,
      insertSize: CS_INSERT_SIZE,
      firstOfPairStrand: CS_FIRST_OF_PAIR,
      pairOrientation: CS_PAIR_ORIENT,
      insertSizeAndOrientation: CS_IS_AND_ORIENT,
      modifications: CS_MODIFICATIONS,
      tag: CS_TAG,
      insertSizeGradient: CS_IS_GRADIENT,
    })
  })

  // The mate-aware membership used to be spelled twice — the `mateAware` flags
  // in the COLOR_SCHEMES registry (which build this set, driving the Canvas2D /
  // SVG / legend path) and a hard-coded `cs == ... || cs == ...` chain in
  // read.slang, kept together only by a SYNC comment. The shader now expresses
  // it as an exported bitmask, so the two are machine-compared: adding a
  // mate-aware scheme to one side and not the other fails here instead of
  // silently painting an unmapped mate a misleading insert-size hue on one
  // backend only.
  test('the mateAware registry flags match the shader orientation mask', () => {
    const mask = [...orientationSchemes].reduce((acc, cs) => acc | (1 << cs), 0)
    expect(mask).toBe(CS_ORIENTATION_MASK)
  })
})
