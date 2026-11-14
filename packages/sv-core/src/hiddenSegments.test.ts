import {
  THROUGH_HIDDEN_LABEL,
  hiddenSegmentsNote,
  throughHiddenLines,
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
