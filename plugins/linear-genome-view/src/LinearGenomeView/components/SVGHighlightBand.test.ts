import { spansAround } from './SVGHighlightBand.tsx'

test('no gaps leaves the whole band', () => {
  expect(spansAround([], 100)).toEqual([{ top: 0, height: 100 }])
})

test('gaps are cut out, including ones touching either end', () => {
  expect(
    spansAround(
      [
        { top: 0, height: 10 },
        { top: 40, height: 20 },
        { top: 90, height: 10 },
      ],
      100,
    ),
  ).toEqual([
    { top: 10, height: 30 },
    { top: 60, height: 30 },
  ])
})
