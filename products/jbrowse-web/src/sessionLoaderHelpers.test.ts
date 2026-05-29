import { splitHighlights } from './sessionLoaderHelpers.ts'

test('splits plain loc strings on spaces', () => {
  expect(splitHighlights('chr1:100-200 chr2:300-400')).toEqual([
    'chr1:100-200',
    'chr2:300-400',
  ])
})

test('keeps a JSON highlight with internal spaces intact', () => {
  expect(
    splitHighlights(
      '{"refName":"chr1","start":1,"end":2,"label":"my region"} chr2:3-4',
    ),
  ).toEqual([
    '{"refName":"chr1","start":1,"end":2,"label":"my region"}',
    'chr2:3-4',
  ])
})

test('handles a single highlight, extra spaces, and empty input', () => {
  expect(splitHighlights('chr1:100-200')).toEqual(['chr1:100-200'])
  expect(splitHighlights('  chr1:1-2   chr2:3-4  ')).toEqual([
    'chr1:1-2',
    'chr2:3-4',
  ])
  expect(splitHighlights('')).toEqual([])
})
