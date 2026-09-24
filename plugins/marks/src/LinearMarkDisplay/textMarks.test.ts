import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { measureText } from '@jbrowse/core/util/measureText'
import { pointInsetPx } from '@jbrowse/render-core/marks'
import { pointYPx } from '@jbrowse/render-core/shaders/pointMark'

import { TEXT_MARK_FONT_PX, placeTextMarks } from './textMarks.ts'

import type {
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
  TextMarkEntry,
} from './markList.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const FONT = { size: TEXT_MARK_FONT_PX, family: 'sans-serif' }
const RED = cssColorToABGR('red')
const TEXT_COLOR = 'rgba(0, 0, 0, 0.87)'

function textLayer(
  spans: [number, number][],
  text: string[],
  extra: Partial<StoredLayer> = {},
): StoredLayer {
  const count = spans.length
  return {
    count,
    skipped: 0,
    x: Uint32Array.from(spans.map(s => s[0])),
    x2: Uint32Array.from(spans.map(s => s[1])),
    featureIndex: Uint32Array.from(spans.map((_, i) => i)),
    color: new Uint32Array(count).fill(RED),
    text,
    yMin: Infinity,
    yMax: -Infinity,
    ...extra,
  }
}

function entry(
  type: TextMarkEntry['type'],
  extra: Partial<TextMarkEntry> = {},
): TextMarkEntry {
  return {
    type,
    minBpPerPx: 0,
    maxBpPerPx: 0,
    placed: true,
    valued: true,
    linkShape: 'dome',
    ownColor: true,
    ...extra,
  }
}

// 1000 bp across 1000 px: one px a bp, so a bp reads as its px.
const BLOCK: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const STATE: MarkRenderState = {
  domainY: [0, 100],
  scaleTypeY: 'linear',
  symlogConstantY: 1,
  colorRamps: [],
  canvasWidth: 1000,
  canvasHeight: 100,
  bpPerPx: 1,
  origin: 0,
  minWidthPx: 1,
  markSizes: [4, 4],
  sizeScales: [],
  linkRegions: [],
  valueInsetPx: 0,
  rowCount: 1,
}

// The value's px in the one 100 px band, as the marks place it.
function valuePx(value: number, insetPx = 0) {
  return pointYPx(value, 0, 100, 100, 0, insetPx, 1)
}

function regions(...layers: StoredLayer[]) {
  return new Map<number, MarkRegionData>([[0, { layers }]])
}

function place(
  entries: TextMarkEntry[],
  layers: StoredLayer[],
  state = STATE,
  blocks = [BLOCK],
) {
  return placeTextMarks(
    entries,
    regions(...layers),
    blocks,
    state,
    FONT,
    TEXT_COLOR,
  )
}

test('a label stands over the middle of its span, just above its value, in its colour', () => {
  const [label] = place(
    [entry('text')],
    [textLayer([[100, 300]], ['geneA'], { y: Float32Array.from([50]) })],
  )
  expect(label).toMatchObject({
    markIndex: 0,
    regionIndex: 0,
    instance: 0,
    text: 'geneA',
    x: 200,
    color: abgrToCssRgba(RED),
  })
  // 50 of 0..100 over 100 px is y 50, and the baseline sits 2 px above it
  expect(label!.baseline).toBe(48)
  expect(label!.width).toBe(measureText('geneA', FONT.size, FONT.family))
})

test('a mark whose colour the config leaves at the default prints in the text colour', () => {
  const [label] = place(
    [entry('text', { ownColor: false })],
    [textLayer([[100, 300]], ['geneA'], { y: Float32Array.from([50]) })],
  )
  expect(label!.color).toBe(TEXT_COLOR)
})

test('a mark naming no y sits in the middle of its row band, whatever a y lane holds', () => {
  const [label] = place(
    [entry('text', { valued: false })],
    [
      textLayer([[100, 200]], ['row1'], {
        row: Uint32Array.from([1]),
        y: Float32Array.from([0]),
      }),
    ],
    { ...STATE, rowCount: 2 },
  )
  // row 1 of two 50 px bands: its middle is 75, and the baseline sits a
  // little under the middle so the glyphs centre on it
  expect(label!.baseline).toBeCloseTo(75 + FONT.size * 0.34)
})

test('a value near the top of its band drops its label below the value, and one near the foot keeps it above', () => {
  const [top, foot] = place(
    [entry('text'), entry('text')],
    [
      textLayer([[100, 200]], ['top'], { y: Float32Array.from([99]) }),
      textLayer([[600, 700]], ['foot'], { y: Float32Array.from([1]) }),
    ],
  )
  expect(valuePx(99)).toBeLessThan(FONT.size)
  expect(top!.baseline).toBe(valuePx(99) + 2 + FONT.size)
  expect(foot!.baseline).toBe(valuePx(1) - 2)
})

test('a label that overlaps the one kept to its left is left out, and one clear of it stays', () => {
  const wide = measureText('a long label', FONT.size, FONT.family)
  const labels = place(
    [entry('text')],
    [
      textLayer(
        [
          [100, 110],
          [100 + wide / 2, 110 + wide / 2],
          [100 + wide * 2, 110 + wide * 2],
        ],
        ['a long label', 'a long label', 'a long label'],
        { y: Float32Array.from([50, 50, 50]) },
      ),
    ],
  )
  expect(labels.map(l => l.instance)).toEqual([0, 2])
})

test('labels on different rows do not cull each other', () => {
  const labels = place(
    [entry('text')],
    [
      textLayer(
        [
          [100, 110],
          [100, 110],
        ],
        ['same place', 'same place'],
        { row: Uint32Array.from([0, 1]) },
      ),
    ],
    { ...STATE, rowCount: 2 },
  )
  expect(labels).toHaveLength(2)
})

test('a label the plot cannot hold whole is left out, at its sides and at its top and foot', () => {
  const labels = place(
    [entry('text')],
    [
      textLayer(
        [
          [0, 10],
          [990, 1000],
          [500, 510],
        ],
        ['left edge', 'right edge', 'middle'],
        { y: Float32Array.from([50, 50, 50]) },
      ),
    ],
  )
  expect(labels.map(l => l.text)).toEqual(['middle'])
  // twenty 5 px bands in a 100 px plot: a label in the first and the last
  // band reaches past the plot, and one in the middle band stands
  const banded = place(
    [entry('text', { valued: false })],
    [
      textLayer(
        [
          [100, 110],
          [300, 310],
          [500, 510],
        ],
        ['first', 'middle', 'last'],
        { row: Uint32Array.from([0, 10, 19]) },
      ),
    ],
    { ...STATE, rowCount: 20 },
  )
  expect(banded.map(l => l.text)).toEqual(['middle'])
})

test('an instance whose midpoint is in another block, an empty label, and a mark outside its zoom range place nothing', () => {
  const left: RenderBlock = { ...BLOCK, end: 500, screenEndPx: 500 }
  const right: RenderBlock = { ...BLOCK, start: 500, screenStartPx: 500 }
  const layer = textLayer(
    [
      [100, 200],
      [600, 700],
      [300, 400],
    ],
    ['left', 'right', ''],
    { y: Float32Array.from([50, 50, 50]) },
  )
  expect(
    place([entry('text')], [layer], STATE, [left, right]).map(l => [
      l.text,
      l.x,
    ]),
  ).toEqual([
    ['left', 150],
    ['right', 650],
  ])
  expect(place([entry('text', { minBpPerPx: 10 })], [layer])).toEqual([])
})

test('only a text mark places labels, whatever lanes its neighbours carry', () => {
  const placed = place(
    [entry('bar'), entry('text')],
    [
      textLayer([[100, 200]], ['bar text'], { y: Float32Array.from([50]) }),
      textLayer([[300, 400]], ['label'], { y: Float32Array.from([50]) }),
    ],
  )
  expect(placed.map(l => [l.markIndex, l.text])).toEqual([[1, 'label']])
})

test('a reversed block places a label at the px its midpoint maps to', () => {
  const [label] = place(
    [entry('text')],
    [textLayer([[100, 300]], ['rev'], { y: Float32Array.from([50]) })],
    STATE,
    [{ ...BLOCK, reversed: true }],
  )
  expect(label!.x).toBe(800)
})

test('the point inset moves a label with the points it labels', () => {
  const inset = pointInsetPx(8)
  const layer = textLayer([[100, 300]], ['p'], { y: Float32Array.from([100]) })
  const [plain] = place([entry('text')], [layer])
  const [inset8] = place([entry('text')], [layer], {
    ...STATE,
    valueInsetPx: inset,
  })
  // the top value is at the plot's top edge with no inset, so its label
  // flips under it; inset, the value sits lower and so does the label
  expect(plain!.baseline).toBe(valuePx(100) + 2 + FONT.size)
  expect(inset8!.baseline).toBe(valuePx(100, inset) + 2 + FONT.size)
  expect(inset8!.baseline).toBeGreaterThan(plain!.baseline)
})
