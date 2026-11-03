import { isSvLaunchFeature, isSvLaunchType } from './svLaunchType.ts'

test('CNVs (copy_number_variation SO term) launch the SV panel', () => {
  // regression: the gate used to match the literal 'cnv', but VCFs carry the
  // SO term 'copy_number_variation', so no launch panel ever rendered
  expect(isSvLaunchType('copy_number_variation')).toBe(true)
})

test('structural SO terms match as substrings', () => {
  expect(isSvLaunchType('inversion')).toBe(true)
  expect(isSvLaunchType('deletion')).toBe(true)
  expect(isSvLaunchType('tandem_duplication')).toBe(true)
  expect(isSvLaunchType('sv')).toBe(true)
})

test('non-structural variant types do not match', () => {
  expect(isSvLaunchType('snv')).toBe(false)
  expect(isSvLaunchType('single_nucleotide_variant')).toBe(false)
  expect(isSvLaunchType('insertion')).toBe(false)
  expect(isSvLaunchType('')).toBe(false)
})

describe('a launch card needs a real structural variant', () => {
  const bases = (n: number) => 'A'.repeat(n)

  test('a symbolic deletion gets the card', () => {
    expect(
      isSvLaunchFeature({ type: 'deletion', REF: 'A', ALT: ['<DEL>'] }),
    ).toBe(true)
  })

  test('a 2 bp deletion does not', () => {
    expect(
      isSvLaunchFeature({ type: 'deletion', REF: 'ATG', ALT: ['A'] }),
    ).toBe(false)
  })

  test('a 60 bp sequence-resolved deletion does', () => {
    expect(
      isSvLaunchFeature({ type: 'deletion', REF: bases(61), ALT: ['A'] }),
    ).toBe(true)
  })

  test('a 49 bp deletion does not and a 50 bp one does', () => {
    expect(
      isSvLaunchFeature({ type: 'deletion', REF: bases(50), ALT: ['A'] }),
    ).toBe(false)
    expect(
      isSvLaunchFeature({ type: 'deletion', REF: bases(51), ALT: ['A'] }),
    ).toBe(true)
  })

  test('a long sequence-resolved insertion has no card, as a symbolic one has none', () => {
    expect(
      isSvLaunchFeature({ type: 'insertion', REF: 'A', ALT: [bases(60)] }),
    ).toBe(false)
    expect(
      isSvLaunchFeature({ type: 'insertion', REF: 'A', ALT: ['<INS>'] }),
    ).toBe(false)
  })

  test('a multiallelic record needs one structural allele', () => {
    expect(
      isSvLaunchFeature({
        type: 'deletion,deletion',
        REF: bases(61),
        ALT: ['A', bases(60)],
      }),
    ).toBe(true)
  })

  test('a record declaring SVTYPE keeps its card', () => {
    expect(
      isSvLaunchFeature({
        type: 'deletion',
        REF: 'ATG',
        ALT: ['A'],
        INFO: { SVTYPE: ['DEL'] },
      }),
    ).toBe(true)
  })
})
