import { headerFit } from './headerFit.ts'

const ORDER = [
  'trackSelectorIndent',
  'panButtonSpacing',
  'scrollZoomLabel',
  'zoomSlider',
  'regionWidth',
] as const

const shed = (width: number | undefined, clearHighlight = false) =>
  ORDER.filter(k => !headerFit(width, clearHighlight)[k])

test('an unmeasured header keeps everything', () => {
  expect(shed(undefined)).toEqual([])
  expect(shed(undefined, true)).toEqual([])
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

// A text search that lands on a feature puts the clear-highlights button in the
// row, and it is the search box that would otherwise pay for it — so every
// threshold moves out by the button's width while it is there.
test('the clear-highlights button sheds the row 35px earlier', () => {
  expect(shed(800)).toEqual([])
  expect(shed(800, true)).toEqual(['trackSelectorIndent'])
  expect(shed(600)).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
  ])
  expect(shed(600, true)).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
    'zoomSlider',
  ])
  expect(shed(500, true)).toEqual([...ORDER])
})

// The point of the order is that a piece never comes back while a cheaper one
// is still gone, which is what makes narrowing the window read as one thing
// tightening rather than as the row reshuffling. A per-piece threshold table
// would pass the cases above and still allow that.
test('what is shed is always a prefix of the order', () => {
  for (const clearHighlight of [false, true]) {
    for (let width = 300; width <= 900; width++) {
      const gone = shed(width, clearHighlight)
      expect(gone).toEqual(ORDER.slice(0, gone.length))
    }
  }
})

test('shedding only ever grows as the header narrows', () => {
  for (const clearHighlight of [false, true]) {
    let previous = 0
    for (let width = 900; width >= 300; width--) {
      const count = shed(width, clearHighlight).length
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
  }
})
