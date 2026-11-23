import { colorDifference } from '@jbrowse/core/ui/colors'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import {
  ALLELE_HUES,
  LAST_ALLELE_SLOT,
  alleleFolds,
  alleleSlot,
} from './alleleHues.ts'
import { ALT_HUE } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'
import { ALLELE_SLOT_BIT } from './variantCellStyles.ts'

test('the commonest alt takes the alt hue every mode paints', () => {
  expect(ALLELE_HUES[alleleSlot(0)]).toBe(ALT_HUE)
})

test('each rank the palette holds takes its own hue, and the rest share the last', () => {
  const last = ALLELE_HUES.length - 1
  expect(ALLELE_HUES.map((_, rank) => alleleSlot(rank))).toEqual(
    ALLELE_HUES.map((_, slot) => slot),
  )
  expect([last, last + 1, 40, -1].map(alleleSlot)).toEqual([
    last,
    last,
    last,
    last,
  ])
  expect([last, last + 1, 40, -1].map(alleleFolds)).toEqual([
    false,
    true,
    true,
    true,
  ])
})

// CIEDE2000
test('every allele hue reads apart from the others and from the absent-data fills', () => {
  const fills = [...ALLELE_HUES, REFERENCE_COLOR, NO_CALL_COLOR, UNPHASED_COLOR]
  const near = ALLELE_HUES.flatMap((hue, i) =>
    fills
      .slice(i + 1)
      .filter(other => colorDifference(hue, other) < 20)
      .map(other => `${hue} ${other}`),
  )
  expect(near).toEqual([])
})

// The first two are the alt blue and red every mode painted before the allele
// hues, the red being the preset's deletion red
test('every allele hue past the second reads apart from each SV type color', () => {
  const near = ALLELE_HUES.slice(2).flatMap(hue =>
    UNIVERSAL_FIELD_PRESETS.svType.scale.range
      .filter(sv => colorDifference(hue, sv) < 20)
      .map(sv => `${hue} ${sv}`),
  )
  expect(near).toEqual([])
})

test('every allele slot bit fits the 16-bit featureCategories', () => {
  expect(ALLELE_SLOT_BIT + LAST_ALLELE_SLOT).toBeLessThan(16)
})
