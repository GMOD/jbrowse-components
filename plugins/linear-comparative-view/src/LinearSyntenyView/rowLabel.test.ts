import { rowLabels } from './rowLabel.ts'

const views = (names: string[][]) =>
  names.map(assemblyNames => ({ assemblyNames }))

test('the ordinary pairwise view is just the two assembly names', () => {
  expect(rowLabels(views([['hg38'], ['mm39']]))).toEqual(['hg38', 'mm39'])
})

test('a row whose assembly has not landed yet is named by position', () => {
  expect(rowLabels(views([['hg38'], []]))).toEqual(['hg38', 'Row 2'])
})

test('only the repeated name pays for the row number', () => {
  expect(rowLabels(views([['peach'], ['grape'], ['peach']]))).toEqual([
    'peach (row 1)',
    'grape',
    'peach (row 3)',
  ])
})

test('every row of an all-same stack is distinguishable', () => {
  expect(rowLabels(views([['hg38'], ['hg38'], ['hg38']]))).toEqual([
    'hg38 (row 1)',
    'hg38 (row 2)',
    'hg38 (row 3)',
  ])
})
