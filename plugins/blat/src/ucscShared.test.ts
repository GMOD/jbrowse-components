import { featureLocString } from './ucscShared.ts'

// the locstring the view navigates to is the whole point of the search, so the
// interbase -> 1-based conversion is worth pinning: a PSL tStart of 7579838 is
// base 7,579,839
test('converts an interbase feature to a 1-based locstring', () => {
  expect(
    featureLocString({
      uniqueId: 'blat-0',
      refName: 'chr17',
      start: 7579838,
      end: 7579985,
    }),
  ).toBe('chr17:7579839-7579985')
})
