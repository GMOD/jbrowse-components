import { headerFit } from './headerFit.ts'

const ORDER = [
  'trackSelectorIndent',
  'panButtonSpacing',
  'scrollZoomLabel',
  'zoomSlider',
  'regionWidth',
] as const

// What `searchBoxWidth` answers for `ctgA:1..20,000`, the locstring the browser
// probe runs against, margins included
const ASK = 194

const shed = (
  width: number | undefined,
  { searchBoxPx = ASK, clearHighlight = false } = {},
) => ORDER.filter(k => !headerFit({ width, searchBoxPx, clearHighlight })[k])

test('an unmeasured header keeps everything', () => {
  expect(shed(undefined)).toEqual([])
  expect(shed(undefined, { clearHighlight: true })).toEqual([])
})

test('a header wide enough for the whole row sheds nothing', () => {
  expect(shed(1388)).toEqual([])
  expect(shed(785)).toEqual([])
})

// The bug the ask replaced a constant to fix: a row sized against the box's
// floor sheds nothing at 800px, and the probe then read the box squeezed to
// 184px of the 210 it asked for.
test('a longer locstring sheds the row earlier', () => {
  expect(shed(800)).toEqual([])
  // `chr22:10,510,000..10,610,000`
  expect(shed(800, { searchBoxPx: 284 })).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
  ])
  // the empty box, whose ask is its floor, back at the 780px the constant drew
  // every threshold from
  expect(shed(780, { searchBoxPx: 189 })).toEqual([])
  expect(shed(779, { searchBoxPx: 189 })).toEqual(['trackSelectorIndent'])
})

test('each piece goes at the width where the row stops holding it', () => {
  expect(shed(784)).toEqual(['trackSelectorIndent'])
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
  expect(shed(819)).toEqual([])
  expect(shed(819, { clearHighlight: true })).toEqual(['trackSelectorIndent'])
  expect(shed(600)).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
  ])
  expect(shed(600, { clearHighlight: true })).toEqual([
    'trackSelectorIndent',
    'panButtonSpacing',
    'scrollZoomLabel',
    'zoomSlider',
  ])
  expect(shed(500, { clearHighlight: true })).toEqual([...ORDER])
})

// The point of the order is that a piece never comes back while a cheaper one
// is still gone, which is what makes narrowing the window read as one thing
// tightening rather than as the row reshuffling. A per-piece threshold table
// would pass the cases above and still allow that.
test('what is shed is always a prefix of the order', () => {
  for (const clearHighlight of [false, true]) {
    for (let width = 300; width <= 900; width++) {
      const gone = shed(width, { clearHighlight })
      expect(gone).toEqual(ORDER.slice(0, gone.length))
    }
  }
})

test('shedding only ever grows as the header narrows', () => {
  for (const clearHighlight of [false, true]) {
    let previous = 0
    for (let width = 900; width >= 300; width--) {
      const count = shed(width, { clearHighlight }).length
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
  }
})
