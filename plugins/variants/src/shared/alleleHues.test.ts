import { colorDifference } from '@jbrowse/core/ui/colors'

import { ALLELE_HUES, alleleFolds, alleleSlot } from './alleleHues.ts'
import { ALT_HUE } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'

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

// CIEDE2000; Set1's brown sat 15 from its red, and its yellow 8 from the
// no-call fill
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
