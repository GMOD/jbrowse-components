import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import { hoverDetailForRow } from './sequenceHover.ts'

const standard = getGeneticCode(1).codonTable

// ATG at coord0 0-2, forward strand
const seq = 'ATGGCC'

test('forward base row reports the reference base', () => {
  expect(
    hoverDetailForRow({ type: 'base', strand: 1 }, seq, 0, 0, false, standard),
  ).toEqual({ type: 'base', strand: 1, base: 'A' })
})

test('reverse base row reports the complement', () => {
  expect(
    hoverDetailForRow({ type: 'base', strand: -1 }, seq, 0, 0, false, standard),
  ).toEqual({ type: 'base', strand: -1, base: 'T' })
})

// The reported strand is the strand of the reported letter, not of the row: a
// flipped block draws the complement in the "forward" row, and echoing the row's
// own strand there labelled that complement "+ strand".
test('reversed block swaps both the complement and the strand it is labelled', () => {
  expect(
    hoverDetailForRow({ type: 'base', strand: 1 }, seq, 0, 0, true, standard),
  ).toEqual({ type: 'base', strand: -1, base: 'T' })
  expect(
    hoverDetailForRow({ type: 'base', strand: -1 }, seq, 0, 0, true, standard),
  ).toEqual({ type: 'base', strand: 1, base: 'A' })
})

// seq[0] is 'A', so whatever row and orientation it was read through, a base
// reported as '+' must be A and one reported as '−' must be T.
test('the reported base is always the reported strand’s base', () => {
  for (const reversed of [false, true]) {
    for (const strand of [1, -1] as const) {
      const detail = hoverDetailForRow(
        { type: 'base', strand },
        seq,
        0,
        0,
        reversed,
        standard,
      )
      expect(detail?.type).toBe('base')
      if (detail?.type === 'base') {
        expect(detail.base).toBe(detail.strand === 1 ? 'A' : 'T')
      }
    }
  }
})

test('frame +1 translates the ATG start codon anywhere in it', () => {
  for (const coord0 of [0, 1, 2]) {
    expect(
      hoverDetailForRow(
        { type: 'translation', frame: 1 },
        seq,
        0,
        coord0,
        false,
        standard,
      ),
    ).toEqual({
      type: 'codon',
      frame: 1,
      codon: 'ATG',
      aminoAcid: 'M',
      kind: 'start',
    })
  }
})

test('negative frame reverse-complements the forward codon', () => {
  // forward slice at coord0=0 in frame -1 is ATG; revcom is CAT -> His
  expect(
    hoverDetailForRow(
      { type: 'translation', frame: -1 },
      seq,
      0,
      0,
      false,
      standard,
    ),
  ).toEqual({
    type: 'codon',
    frame: -1,
    codon: 'CAT',
    aminoAcid: 'H',
    kind: 'normal',
  })
})

test('stop codon TAA is flagged', () => {
  expect(
    hoverDetailForRow(
      { type: 'translation', frame: 1 },
      'TAA',
      0,
      0,
      false,
      standard,
    ),
  ).toEqual({
    type: 'codon',
    frame: 1,
    codon: 'TAA',
    aminoAcid: '*',
    kind: 'stop',
  })
})

test('partial codon at the sequence edge yields no amino acid', () => {
  expect(
    hoverDetailForRow(
      { type: 'translation', frame: 1 },
      'AT',
      0,
      0,
      false,
      standard,
    ),
  ).toBeUndefined()
})
