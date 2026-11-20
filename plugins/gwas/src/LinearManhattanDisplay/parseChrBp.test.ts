import { chrBpLabel, indexSnpLabel } from './parseChrBp.ts'

test('a locus label carries thousands commas, as the right-click row shows', () => {
  expect(chrBpLabel({ refName: 'chr2', bp: 191_958_656 })).toBe(
    'chr2:191,958,656',
  )
  expect(indexSnpLabel('chr2:191958656')).toBe('chr2:191,958,656')
  expect(indexSnpLabel('rs12345')).toBe('rs12345')
})
