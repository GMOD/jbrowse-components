import { flipCigar } from './util.ts'

test('flip cigar', () => {
  expect(flipCigar('3M5D5M5I6M')).toEqual('6M5D5M5I3M')
})
