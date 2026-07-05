import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import { hoverDetailForRow, rowLayout } from './sequenceHover.ts'

const standard = getGeneticCode(1).codonTable

test('rowLayout forward orientation stacks fwd frames, bases, rev frames', () => {
  expect(
    rowLayout({
      showForward: true,
      showReverse: true,
      showTranslation: true,
      reversed: false,
    }),
  ).toEqual([
    { type: 'translation', frame: 3 },
    { type: 'translation', frame: 2 },
    { type: 'translation', frame: 1 },
    { type: 'base', strand: 1 },
    { type: 'base', strand: -1 },
    { type: 'translation', frame: -1 },
    { type: 'translation', frame: -2 },
    { type: 'translation', frame: -3 },
  ])
})

test('rowLayout reversed flips frame ordering', () => {
  expect(
    rowLayout({
      showForward: true,
      showReverse: true,
      showTranslation: true,
      reversed: true,
    }),
  ).toEqual([
    { type: 'translation', frame: -3 },
    { type: 'translation', frame: -2 },
    { type: 'translation', frame: -1 },
    { type: 'base', strand: 1 },
    { type: 'base', strand: -1 },
    { type: 'translation', frame: 1 },
    { type: 'translation', frame: 2 },
    { type: 'translation', frame: 3 },
  ])
})

test('rowLayout without translation is just the base rows', () => {
  expect(
    rowLayout({
      showForward: true,
      showReverse: false,
      showTranslation: false,
      reversed: false,
    }),
  ).toEqual([{ type: 'base', strand: 1 }])
})

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

test('reversed block swaps which row shows the complement', () => {
  expect(
    hoverDetailForRow({ type: 'base', strand: 1 }, seq, 0, 0, true, standard),
  ).toEqual({ type: 'base', strand: 1, base: 'T' })
  expect(
    hoverDetailForRow({ type: 'base', strand: -1 }, seq, 0, 0, true, standard),
  ).toEqual({ type: 'base', strand: -1, base: 'A' })
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
