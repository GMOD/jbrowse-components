import { headerFit } from './headerFit.ts'

const ORDER = [
  'trackSelectorIndent',
  'panButtonSpacing',
  'scrollZoomLabel',
  'zoomSlider',
  'regionWidth',
] as const

const shed = (width: number | undefined) =>
  ORDER.filter(k => !headerFit(width)[k])

test('an unmeasured header keeps everything', () => {
  expect(shed(undefined)).toEqual([])
})

test('a header wide enough for the whole row sheds nothing', () => {
  expect(shed(1388)).toEqual([])
  expect(shed(780)).toEqual([])
})

test('each piece goes at the width where the row stops holding it', () => {
  expect(shed(779)).toEqual(['trackSelectorIndent'])
  // the header of a 700px window
  expect(shed(688)).toEqual(['trackSelectorIndent', 'panButtonSpacing'])
  expect(shed(588)).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
  ])
  expect(shed(488)).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
    'zoomSlider',
  ])
  expect(shed(408)).toEqual([...ORDER])
})

// The point of the order is that a piece never comes back while a cheaper one
// is still gone, which is what makes narrowing the window read as one thing
// tightening rather than as the row reshuffling. A per-piece threshold table
// would pass the cases above and still allow that.
test('what is shed is always a prefix of the order', () => {
  for (let width = 300; width <= 900; width++) {
    const gone = shed(width)
    expect(gone).toEqual(ORDER.slice(0, gone.length))
  }
})

test('shedding only ever grows as the header narrows', () => {
  let previous = 0
  for (let width = 900; width >= 300; width--) {
    const count = shed(width).length
    expect(count).toBeGreaterThanOrEqual(previous)
    previous = count
  }
})
