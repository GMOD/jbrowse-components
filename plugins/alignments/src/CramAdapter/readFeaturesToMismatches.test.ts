import { readFeaturesToMismatches } from './readFeaturesToMismatches'

test('cram read features mismatches', () => {
  expect(
    // from ctgA_15140_15565_0:0:1_1:0:0_2e8 in volvox-sorted.cram
    readFeaturesToMismatches(
      [{ code: 'i', data: 'C', pos: 25, refPos: 15164 }],
      15139,
    ),
  ).toMatchSnapshot()
})
