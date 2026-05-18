import { normalizeSamples } from './getSamples.ts'

test('string array — id used as label fallback', () => {
  expect(normalizeSamples(['hg38', 'mm10'])).toEqual([
    { id: 'hg38', label: 'hg38' },
    { id: 'mm10', label: 'mm10' },
  ])
})

test('object array with explicit label and color preserved', () => {
  expect(
    normalizeSamples([
      { id: 'hg38', label: 'Human', color: 'red' },
      { id: 'mm10', label: 'Mouse' },
    ]),
  ).toEqual([
    { id: 'hg38', label: 'Human', color: 'red' },
    { id: 'mm10', label: 'Mouse', color: undefined },
  ])
})

test('object array — missing label defaults to id', () => {
  expect(normalizeSamples([{ id: 'hg38' }])).toEqual([
    { id: 'hg38', label: 'hg38', color: undefined },
  ])
})

test('empty array', () => {
  expect(normalizeSamples([])).toEqual([])
})
