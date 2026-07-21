import { isSvLaunchType } from './svLaunchType.ts'

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
