import { flipCigar } from './util'

test('flip cigar', () => {
  expect(flipCigar(['3', 'M', '5', 'D', '5', 'M', '5', 'I', '6', 'M'])).toEqual(
    ['6', 'M', '5', 'D', '5', 'M', '5', 'I', '3', 'M'],
  )
})
