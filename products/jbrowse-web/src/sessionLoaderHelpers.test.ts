import { buildLgvInit } from './sessionLoaderHelpers.ts'

test('buildLgvInit splits the regions param into displayedRegionNames', () => {
  expect(
    buildLgvInit({ assembly: 'hg38', regions: 'chr1,chr2,chr3' })
      .displayedRegionNames,
  ).toEqual(['chr1', 'chr2', 'chr3'])
})

test('buildLgvInit leaves displayedRegionNames undefined without a regions param', () => {
  expect(
    buildLgvInit({ assembly: 'hg38', loc: 'chr1:1-100' }).displayedRegionNames,
  ).toBeUndefined()
})
