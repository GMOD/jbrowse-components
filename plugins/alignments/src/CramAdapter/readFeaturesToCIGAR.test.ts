import { readFeaturesToCIGAR } from './readFeaturesToCIGAR'

test('cram read features to CIGAR', () => {
  expect(
    // from ctgA_15140_15565_0:0:1_1:0:0_2e8 in volvox-sorted.cram
    readFeaturesToCIGAR(
      [{ code: 'i', data: 'C', pos: 25, refPos: 15164 }],
      15140,
      100,
    ),
  ).toMatchSnapshot()
})
