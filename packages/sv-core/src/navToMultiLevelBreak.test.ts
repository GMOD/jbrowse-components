import { multiLevelWindowSize } from './navToMultiLevelBreak.ts'

test('junction stops keep the window the reader set', () => {
  expect(
    multiLevelWindowSize(5000, [
      { refName: 'chr1', pos: 10 },
      { refName: 'chr2', pos: 20 },
    ]),
  ).toBe(5000)
})

// A panel shows two windows, so 0.6 of the longest segment either side of its
// midpoint shows the whole of it with a tenth of its length spare each side.
test('a segment longer than the window widens it to fit', () => {
  expect(
    multiLevelWindowSize(5000, [
      { refName: 'chr1', pos: 10, span: 300 },
      { refName: 'chr2', pos: 20, span: 20_000 },
    ]),
  ).toBe(12_000)
})
