import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { measureText } from '@jbrowse/core/util/measureText'
import { TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { pointInsetPx } from '@jbrowse/render-core/marks'
import { pointYPx } from '@jbrowse/render-core/shaders/pointMark'

import { buildMarkList } from './markList.ts'
import {
  TEXT_MARK_FONT_PX,
  labelTopAtApex,
  placeTextMarks,
} from './textMarks.ts'

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
  colorScales: [],
  canvasWidth: 1000,
  canvasHeight: 100,
  bpPerPx: 1,
  origin: 0,
  minWidthPx: 1,
  markSizes: [4, 4],
  sizeScales: [],
  linkRegions: [],
  valueInsetPx: 0,
  rowHeight: 100,
  rowProportions: [1, 1],
  scrollTop: 0,
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

test('a constant colour, one number for the layer, prints every label in it', () => {
  const labels = place(
    [entry('text')],
    [
      textLayer(
        [
          [100, 200],
          [500, 600],
        ],
        ['a', 'b'],
        { color: RED },
      ),
    ],
  )
  expect(labels.map(l => l.color)).toEqual([
    abgrToCssRgba(RED),
    abgrToCssRgba(RED),
  ])
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
    { ...STATE, rowHeight: 50 },
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
    { ...STATE, rowHeight: 50 },
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
    { ...STATE, rowHeight: 5 },
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

describe('a count beside a link mark stands at the apex of the arc on its feet', () => {
  const STROKE = 2
  const linkState: MarkRenderState = {
    ...STATE,
    markSizes: [STROKE, 4],
    linkRegions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }],
  }
  const linkEntry = entry('link', { valued: false })
  const countEntry = entry('text', { valued: false })

  function linkLayer(
    spans: [number, number][],
    extra: Partial<StoredLayer> = {},
  ): StoredLayer {
    return {
      ...textLayer(spans, []),
      text: undefined,
      x2Region: new Uint32Array(spans.length),
      ...extra,
    }
  }

  // The top of the box the display's link mark strokes the arc in: the
  // stroke's outer edge at the apex.
  function drawnTop(layer: StoredLayer, i: number, linkMarkEntry = linkEntry) {
    const [mark] = buildMarkList([linkMarkEntry])
    return mark!.ink!({ layers: [layer] }, BLOCK, linkState, i)!.top
  }

  const glyphTop = (label: { baseline: number }) =>
    label.baseline - FONT.size * TEXT_BASELINE_RATIO

  test('each count sits just inside its own arc, not at a height two arcs share', () => {
    // a wide dome capped at the band's top, and a narrower one under it
    const spans: [number, number][] = [
      [100, 500],
      [200, 360],
    ]
    const arcs = linkLayer(spans)
    const labels = place(
      [linkEntry, countEntry],
      [arcs, textLayer(spans, ['13', '21'])],
      linkState,
    )
    expect(labels.map(l => [l.instance, l.text, l.x])).toEqual([
      [1, '21', 280],
      [0, '13', 300],
    ])
    for (const label of labels) {
      expect(glyphTop(label)).toBeCloseTo(
        drawnTop(arcs, label.instance) + STROKE + 2,
      )
    }
    expect(glyphTop(labels[0]!)).toBeGreaterThan(
      glyphTop(labels[1]!) + FONT.size,
    )
  })

  test('an arc too low to hold its count puts it just above the apex', () => {
    const arcs = linkLayer([[500, 520]])
    const [label] = place(
      [linkEntry, countEntry],
      [arcs, textLayer([[500, 520]], ['8'])],
      linkState,
    )
    expect(glyphTop(label!) + FONT.size).toBeCloseTo(drawnTop(arcs, 0) - 2)
  })

  test('a valued arc holds its count under the value its apex stands at', () => {
    const valued = { ...linkEntry, valued: true }
    const arcs = linkLayer([[100, 500]], { y: Float32Array.from([50]) })
    const [label] = place(
      [valued, countEntry],
      [arcs, textLayer([[100, 500]], ['5'])],
      linkState,
    )
    expect(drawnTop(arcs, 0, valued)).toBeCloseTo(valuePx(50) - STROKE / 2)
    expect(glyphTop(label!)).toBeCloseTo(valuePx(50) + STROKE / 2 + 2)
  })

  test('a far pair, whose band shows only its legs, carries no count', () => {
    // feet 7000 px apart, either side of the canvas, the middle on it
    const spans: [number, number][] = [[100, 7100]]
    const counts = textLayer(spans, ['3'])
    const state = {
      ...linkState,
      linkRegions: [{ anchorPx: -3000, anchorBp: 0, signedPxPerBp: 1 }],
    }
    const blocks = [
      { ...BLOCK, end: 10000, screenStartPx: -3000, screenEndPx: 7000 },
    ]
    expect(
      place([linkEntry, countEntry], [linkLayer(spans), counts], state, blocks),
    ).toEqual([])
    expect(place([countEntry], [counts], state, blocks)).toEqual([
      expect.objectContaining({ x: 600 }),
    ])
  })

  test('a count no arc draws on keeps the middle of its band, and one with its own y keeps its value', () => {
    const labels = place(
      [linkEntry, countEntry, entry('text')],
      [
        linkLayer([[100, 500]]),
        textLayer([[600, 700]], ['lone']),
        textLayer([[100, 500]], ['valued'], { y: Float32Array.from([50]) }),
      ],
      linkState,
    )
    expect(labels.map(l => [l.text, l.baseline])).toEqual([
      ['valued', valuePx(50) - 2],
      ['lone', 50 + FONT.size * (TEXT_BASELINE_RATIO - 0.5)],
    ])
  })

  test('a curve hanging from its band s top holds its count above the apex, toward the baseline', () => {
    const apex = {
      x: 300,
      y: 60,
      rise: 60,
      halfWidth: 200,
      strokePx: STROKE,
      inward: -1,
    } as const
    expect(labelTopAtApex(apex, 10, FONT.size)).toBe(
      60 - STROKE / 2 - 2 - FONT.size,
    )
    expect(labelTopAtApex({ ...apex, rise: 8, y: 8 }, 10, FONT.size)).toBe(
      8 + STROKE / 2 + 2,
    )
  })
})
