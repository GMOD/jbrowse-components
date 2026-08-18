import {
  categorySwatchColor,
  rgb255,
  swatchPaletteKeys,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { arcColorLegendCategory } from '../features/arcs/arcColors.ts'
import {
  LINKED_READ_COLOR_PAIR_LL,
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_PAIR_RL,
  LINKED_READ_COLOR_PAIR_RR,
  LINKED_READ_COLOR_SPLIT_INV,
  LINKED_READ_COLOR_SPLIT_NORMAL,
  connectionLabel,
} from '../features/linkedReads/compute.ts'
import { readColorCategoryLabel } from '../shared/legendUtils.ts'
import {
  ARC_SLOT_CATEGORY,
  buildArcColorPalette,
  buildLinkedReadColorPalette,
} from './palettes.ts'

import type {
  ReadColorCategory,
  SwatchCategory,
} from '../LinearAlignmentsDisplay/colorUtils.ts'

// A pileup draws one meaning through three vocabularies — read fills, arc /
// read-cloud overlays, linked-read connectors — and each used to carry its own
// colour table, agreeing by comment. That is how the overlays came to be baked
// from the module palette while the read fills resolved through the theme: in
// the default light palette the divergence is invisible, and light is where
// every figure is captured.
//
// The colour half of this file is now a TAUTOLOGY, and deliberately kept as one.
// ARC_SLOT_CATEGORY / LINKED_READ_SLOT_CATEGORY say what a slot means and the
// colour is resolved through `swatchPaletteKeys`, the read fills' own table, so
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
  test.each([
    ['arc', buildArcColorPalette],
    ['linked read', buildLinkedReadColorPalette],
  ])('%s palette resolves against the palette it is given', (_name, build) => {
    // Nothing is left over from the module constants: every slot has to be one
    // of the values this palette carries.
    const carried = new Set(
      Object.values(OVERRIDDEN).map(c => (c as number[]).join(',')),
    )
    for (const slot of build(OVERRIDDEN)) {
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
      const category = arcColorLegendCategory(slot, 'insertSizeAndOrientation')
      expect([slot, rgb255(rgb)]).toEqual([
        slot,
        categorySwatchColor(category as SwatchCategory, OVERRIDDEN),
      ])
    }
  })

  // Same claim for the connector palette, whose slots are the orientation codes
  // plus the two split junctions.
  test('each connector slot equals the read swatch it shares a meaning with', () => {
    const linked = buildLinkedReadColorPalette(OVERRIDDEN)
    const expected: [number, ReadColorCategory][] = [
      [LINKED_READ_COLOR_PAIR_LR, 'pairLR'],
      [LINKED_READ_COLOR_PAIR_RL, 'pairRL'],
      [LINKED_READ_COLOR_PAIR_RR, 'pairRR'],
      [LINKED_READ_COLOR_PAIR_LL, 'pairLL'],
      [LINKED_READ_COLOR_SPLIT_NORMAL, 'splitDeletion'],
      [LINKED_READ_COLOR_SPLIT_INV, 'splitInversion'],
    ]
    for (const [slot, category] of expected) {
      expect([category, rgb255(linked[slot]!)]).toEqual([
        category,
        categorySwatchColor(category as SwatchCategory, OVERRIDDEN),
      ])
    }
  })
})

// The other half of the same problem, in strings rather than colors. Both files
// carry a comment saying these must agree word for word — legendUtils because
// "one box can show both", `connectionLabel` because "a color means one thing
// whether the reader met it on a swatch, a fill or a curve". They are two hand-
// kept tables, and `getAlignmentsLegendSections` de-dupes the connections
// section against the already-keyed rows on `${color} ${label}`: drift one
// string and the same connection is keyed twice in one box under two wordings.
// One of these has already drifted once ("deletion"), and it was caught by
// somebody reading a legend.
describe('connector labels match the read key word for word', () => {
  test.each([
    [LINKED_READ_COLOR_PAIR_LR, 'pairLR'],
    [LINKED_READ_COLOR_PAIR_RL, 'pairRL'],
    [LINKED_READ_COLOR_PAIR_RR, 'pairRR'],
    [LINKED_READ_COLOR_PAIR_LL, 'pairLL'],
  ] as [number, ReadColorCategory][])(
    'connector %i uses the same wording as its read swatch',
    (colorType, category) => {
      expect(connectionLabel(colorType)).toBe(readColorCategoryLabel(category))
    },
  )
})

// THE ONE MEANING STILL SPLIT ACROSS THE TWO CLASSIFIERS, pinned so it stays
// visible. A pair with NO computed orientation (po 0) is 'nonSplit' to the read
// fills — deliberately the neutral grey, "distinct from the strand-colored split
// segments" — while the arc has no such slot and falls to its baseline, which is
// pairLR. Two greys, but not the same grey, and two legend rows for one thing.
//
// Fixing it is not a refactor, it is a decision: either the arcs grow a
// nonSplit slot (a shader uniform wider by one) or the reads stop distinguishing
// it. Everything else these two once disagreed about is now derived from one
// table; this is what is left.
describe('known gap: unknown pair orientation', () => {
  test('the arc baseline and the read fill are still different greys', () => {
    expect(swatchPaletteKeys.nonSplit).not.toBe(swatchPaletteKeys.pairLR)
    expect(ARC_SLOT_CATEGORY[0]).toBe('normalInsert')
    expect(arcColorLegendCategory(0, 'orientation')).toBe('pairLR')
  })
})
