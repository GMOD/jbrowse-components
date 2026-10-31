import {
  categorySwatchColor,
  rgb255,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  ARC_SPLIT_SWATCH,
  isArcSplitCategory,
} from '../features/arcs/arcSplitCategory.ts'
import {
  ARC_SLOT_CATEGORY,
  arcSlotCategory,
  buildArcColorPalette,
} from './palettes.ts'

// A pileup draws one meaning through two vocabularies — read fills, and the
// read connections (arcs, read cloud and connectors) — and each used to carry
// its own color table, agreeing by comment. That is how the overlays came to be baked
// from the module palette while the read fills resolved through the theme: in
// the default light palette the divergence is invisible, and light is where
// every figure is captured.
//
// The color half of this file is now a TAUTOLOGY, and deliberately kept as one.
// ARC_SLOT_CATEGORY says what a slot means and the
// color is resolved through `swatchPaletteKeys`, the read fills' own table, so
// there is one table and nothing left to reconcile. What these assertions still
// buy is the wiring: they fail if any path goes back to a baked constant, or if
// a slot is pointed at the wrong meaning.
//
// `makeTestPalette` is deliberately NOT the stock palette. Every entry below is
// distinct, so a path reading a module constant cannot pass by coincidence —
// which is exactly how the original survived.
const OVERRIDDEN = makeTestPalette({
  colorPairLR: [0.11, 0.12, 0.13],
  colorPairRL: [0.21, 0.22, 0.23],
  colorPairRR: [0.31, 0.32, 0.33],
  colorPairLL: [0.41, 0.42, 0.43],
  colorSupplementary: [0.51, 0.52, 0.53],
  colorSplitInversion: [0.61, 0.62, 0.63],
  colorLongInsert: [0.71, 0.72, 0.73],
  colorShortInsert: [0.81, 0.82, 0.83],
  colorInterchrom: [0.91, 0.92, 0.93],
})

describe('overlay palettes follow the theme', () => {
  test('the arc palette resolves against the palette it is given', () => {
    // Nothing is left over from the module constants: every slot has to be one
    // of the values this palette carries.
    const carried = new Set(
      Object.values(OVERRIDDEN)
        .filter(c => Array.isArray(c))
        .map(c => c.join(',')),
    )
    for (const slot of buildArcColorPalette(OVERRIDDEN)) {
      expect(carried).toContain(slot.join(','))
    }
  })

  // The sharp one. An arc slot and the read swatch it maps to are the SAME
  // meaning, so a themed pileup must not paint them two colors — that is the
  // dark-mode bug this file exists to stop coming back (`pairLR` is the entry
  // the stock dark palette dims).
  test('each arc slot equals the read swatch of the category it keys', () => {
    const arc = buildArcColorPalette(OVERRIDDEN)
    for (const [slot, rgb] of arc.entries()) {
      const category = arcSlotCategory(slot)
      const swatch = isArcSplitCategory(category)
        ? ARC_SPLIT_SWATCH[category]
        : category
      expect([slot, rgb255(rgb)]).toEqual([
        slot,
        categorySwatchColor(swatch, OVERRIDDEN),
      ])
    }
  })
})

// The arc baseline is the normal insert, the read fill's neutral grey.
describe('the arc baseline', () => {
  test('is the normal insert', () => {
    expect(ARC_SLOT_CATEGORY[0]).toBe('normalInsert')
    expect(arcSlotCategory(0)).toBe('normalInsert')
  })
})
