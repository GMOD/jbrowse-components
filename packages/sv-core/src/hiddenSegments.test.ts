import {
  THROUGH_HIDDEN_LABEL,
  hiddenSegmentsNote,
  throughHiddenKeyLabel,
  throughHiddenLines,
  throughHiddenRefNames,
} from './hiddenSegments.ts'

const seg = (refName: string, loc: string) => ({ refName, loc })

// The wording itself, because it is the point of the shared module: the
// alignments overlay and the breakpoint split view show one phrasing.
test('the note names the loci the connector passes through', () => {
  expect(hiddenSegmentsNote([seg('chr2', 'chr2:1-100')])).toBe(
    'passes through chr2:1-100',
  )
  expect(
    hiddenSegmentsNote([seg('chr2', 'chr2:1-100'), seg('chr3', 'chr3:5-9')]),
  ).toBe('passes through chr2:1-100, chr3:5-9')
})

test('the hover states the loci, then how the two ends relate where that says something', () => {
  const colo829 = [
    seg('chr10', 'chr10:600,001-600,199'),
    seg('chr12', 'chr12:700,001-700,183'),
  ]
  expect(throughHiddenLines(colo829, 'inversion, LL-type')).toEqual([
    'passes through chr10:600,001-600,199, chr12:700,001-700,183',
    'ends relate as: inversion, LL-type',
  ])
  expect(throughHiddenLines(colo829, undefined)).toEqual([
    'passes through chr10:600,001-600,199, chr12:700,001-700,183',
  ])
  expect(THROUGH_HIDDEN_LABEL).toBe('Split read (segment not in view)')
})

test('the key names each refName the reads went through once, in first-seen order', () => {
  const refNames = throughHiddenRefNames([
    [seg('chr10', 'a'), seg('chr12', 'b')],
    undefined,
    [seg('chr3', 'c'), seg('chr10', 'd')],
  ])
  expect([...refNames]).toEqual(['chr10', 'chr12', 'chr3'])
  expect(throughHiddenKeyLabel(refNames)).toBe(
    'Split read via chr10, chr12, chr3 (not in view)',
  )
  expect(throughHiddenKeyLabel(new Set(['chr10']))).toBe(
    'Split read via chr10 (not in view)',
  )
})

test('past three refNames the key counts them', () => {
  expect(throughHiddenKeyLabel(new Set(['chr1', 'chr2', 'chr5', 'chrX']))).toBe(
    'Split read via 4 reference sequences (not in view)',
  )
})
