import { dropLoneTickLabels, tickLabelsWorthDrawing } from './tickLabels.ts'

// The rule two views share: a region with too few coordinate labels to make a
// ruler shows none. Both reach it at whole-genome zoom, where tick pitch comes
// from the whole displayed-region set and each chromosome catches one number.

test('one label is not a ruler, two are', () => {
  expect(tickLabelsWorthDrawing(0)).toBe(false)
  expect(tickLabelsWorthDrawing(1)).toBe(false)
  expect(tickLabelsWorthDrawing(2)).toBe(true)
})

test('a lone label goes and a real ruler stays, in the same list', () => {
  const labels = [
    { region: 'chr1', at: 40 },
    { region: 'chr2', at: 200 },
    { region: 'chr2', at: 300 },
  ]
  expect(dropLoneTickLabels(labels, l => l.region)).toEqual([
    { region: 'chr2', at: 200 },
    { region: 'chr2', at: 300 },
  ])
})

// The identity is the caller's, and it has to separate two regions that can sit
// side by side. Pooling them would let each keep the lone number the rule exists
// to remove.
test('two groups of one are two groups, not a quorum', () => {
  const labels = [
    { region: 0, at: 40 },
    { region: 1, at: 400 },
  ]
  expect(dropLoneTickLabels(labels, l => l.region)).toEqual([])
  expect(dropLoneTickLabels(labels, () => 'pooled')).toEqual(labels)
})

test('an empty list is not an error', () => {
  expect(dropLoneTickLabels([], l => l)).toEqual([])
})
