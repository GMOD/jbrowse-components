import { hiddenSegmentsNote } from './hiddenSegments.ts'

// The wording itself, because it is the point of the shared module: the
// alignments overlay and the breakpoint split view show one phrasing, and both
// of their own tests mock this function away.
test('the note names the loci and agrees in number', () => {
  expect(hiddenSegmentsNote(['chr2:1-100'])).toBe(
    'hidden segment not in view: chr2:1-100',
  )
  expect(hiddenSegmentsNote(['chr2:1-100', 'chr3:5-9'])).toBe(
    'hidden segments not in view: chr2:1-100, chr3:5-9',
  )
})
