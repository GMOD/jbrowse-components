import { expect, test } from 'vitest'

import { getModPositions } from './getModPositions'

test('getModPositions', () => {
  const positions = getModPositions(
    'C+m,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    type: 'm',
    base: 'C',
    strand: '+',
    positions: [6, 17, 20, 31, 34],
  })
})

// ? means "modification status of the skipped bases provided."
test('getModPositions with unknown (?)', () => {
  const positions = getModPositions(
    'C+m?,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    type: 'm',
    base: 'C',
    strand: '+',
    positions: [6, 17, 20, 31, 34],
  })
})

// . means "modification status of the skipped bases is low probability"
test('getModPositions with unknown (.)', () => {
  const positions = getModPositions(
    'C+m.,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    base: 'C',
    strand: '+',
    type: 'm',
    positions: [6, 17, 20, 31, 34],
  })
})
