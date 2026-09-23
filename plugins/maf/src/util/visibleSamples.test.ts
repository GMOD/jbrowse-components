import { visibleSamples } from './visibleSamples.ts'

const listed = [
  { id: 'hg38', label: 'hg38' },
  { id: 'mm10', label: 'mm10' },
]

test('a focus naming a listed species ships that set', () => {
  expect(visibleSamples(['mm10', 'rn6'], listed)).toEqual(
    new Set(['mm10', 'rn6']),
  )
})

// The display's `keptRows` draws every row for such a focus, so shipping none
// would leave those rows empty.
test('a focus naming no listed species ships every species', () => {
  expect(visibleSamples(['rn6'], listed)).toBeUndefined()
})

// A discovery track lists nothing before it reads its blocks.
test('a focus on a track that lists no species applies as given', () => {
  expect(visibleSamples(['rn6'], [])).toEqual(new Set(['rn6']))
})

test('no focus ships every species', () => {
  expect(visibleSamples(undefined, listed)).toBeUndefined()
  expect(visibleSamples([], listed)).toBeUndefined()
})
