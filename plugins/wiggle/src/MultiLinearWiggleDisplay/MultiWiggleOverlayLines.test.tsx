import { renderToString } from 'react-dom/server'

import MultiWiggleOverlayLines from './MultiWiggleOverlayLines.tsx'

// Two tick levels, so a per-row hatch set is two lines and the per-row offset is
// visible in the output.
const ticks = {
  values: [0, 100],
  yTop: 0,
  yBottom: 30,
  items: [
    { value: 0, y: 30, label: '0' },
    { value: 100, y: 0, label: '100' },
  ],
}

function makeModel(overrides: Partial<Parameters<typeof render>[0]> = {}) {
  return {
    isOverlay: false,
    isDensityMode: false,
    showRowSeparators: true,
    showCrossHatches: false,
    numRows: 3,
    effectiveRowHeight: 30,
    ticks: undefined,
    ...overrides,
  }
}

function render(model: {
  isOverlay: boolean
  isDensityMode: boolean
  showRowSeparators: boolean
  showCrossHatches: boolean
  numRows: number
  effectiveRowHeight: number
  ticks?: typeof ticks
}) {
  return renderToString(
    <svg>
      <MultiWiggleOverlayLines model={model} width={800} />
    </svg>,
  )
}

// The separator hairline follows the theme's divider color through
// getStrokeProps, which splits the alpha onto its own attribute; the hatches are
// wiggle-core's fixed grey. Counting by that is what tells the two apart in one
// flat list of <line>s.
function separatorYs(svg: string) {
  return [...svg.matchAll(/<line x1="0" y1="([\d.]+)"/g)].map(m => Number(m[1]))
}
function strokeOpacity(svg: string) {
  return Number(/stroke-opacity="([\d.]+)"/.exec(svg)?.[1])
}
function hatchYs(svg: string) {
  return [
    ...svg.matchAll(/y1="([\d.]+)" y2="[\d.]+" stroke="rgb\(200,200,200\)"/g),
  ].map(m => Number(m[1]))
}

describe('row separators', () => {
  // One line per row boundary, so three rows get two. The +0.5 lands the 1px
  // stroke on a device-pixel boundary instead of straddling two rows.
  it('draws one hairline per boundary, offset half a pixel', () => {
    const svg = render(makeModel())
    expect(separatorYs(svg)).toEqual([30.5, 60.5])
    expect(svg).toContain('x2="800"')
  })

  // An auto-fit row height is fractional, and a boundary at 20.52 falls in
  // pixel 20 -- where the two rows' fills already blend. Rounding would put the
  // line on 21, a pixel below the boundary it divides.
  it('puts each line on the pixel its boundary falls in at a fractional row height', () => {
    const svg = render(makeModel({ effectiveRowHeight: 6.84, numRows: 4 }))
    expect(separatorYs(svg)).toEqual([6.5, 13.5, 20.5])
  })

  // Overlay collapses every source onto one plot, so there is no boundary to
  // draw even with the setting on.
  it('draws none in an overlay rendering', () => {
    expect(separatorYs(render(makeModel({ isOverlay: true })))).toEqual([])
  })

  it('draws none for a single row', () => {
    expect(separatorYs(render(makeModel({ numRows: 1 })))).toEqual([])
  })

  it('draws none when the setting is off', () => {
    expect(
      separatorYs(render(makeModel({ showRowSeparators: false }))),
    ).toEqual([])
  })

  // A clustered cohort auto-fits hundreds of subtracks into the track height, so
  // its rows go below a pixel — and one hairline per boundary there is not a
  // grid over the plot, it IS the plot. `RowSeparatorLines` floors at
  // MIN_SEPARATOR_ROW_PX for that reason and this display took the floor by
  // taking the default, which used to be 0.
  it('draws none once the rows are too short to divide', () => {
    expect(
      separatorYs(
        render(makeModel({ effectiveRowHeight: 0.32, numRows: 1987 })),
      ),
    ).toEqual([])
  })

  // Density rows are edge-to-edge saturated fill, so the line is dialed up to
  // stay visible over them; xyplot rows sit on paper and can take a fainter one.
  it('is stronger over density fill than over an xyplot', () => {
    // The alpha round-trips through an 8-bit channel, so compare the two rather
    // than pinning either float. It being on its own attribute at all is the
    // other half of the contract: renderToStaticMarkup strips rgba() alpha, so
    // an inline one would survive on screen and vanish from the export.
    expect(
      strokeOpacity(render(makeModel({ isDensityMode: true }))),
    ).toBeGreaterThan(strokeOpacity(render(makeModel())))
  })
})

describe('cross hatches', () => {
  // One set per row, each offset to its row's top — the same numRows the
  // separators count boundaries from, so the two can't disagree about where a
  // row starts.
  //
  // The bottom line of each row draws at 29.5, not at its tick's y of 30:
  // `clampStrokeInsideAxis` puts the 1px stroke marking a row's bottom edge on
  // the last pixel inside that row. Centered on 30 it straddled 29 and 30, and
  // rows stack edge to edge, so half of it landed in the next sample.
  it('repeats the tick levels once per row', () => {
    const svg = render(makeModel({ showCrossHatches: true, numRows: 2, ticks }))
    expect(hatchYs(svg)).toEqual([29.5, 0, 59.5, 30])
  })

  // Overlay is one row over the full height, so its hatches draw once.
  it('draws one set in an overlay rendering', () => {
    const svg = render(
      makeModel({
        showCrossHatches: true,
        isOverlay: true,
        numRows: 1,
        ticks,
      }),
    )
    expect(hatchYs(svg)).toEqual([29.5, 0])
  })

  // The same wash the separators drew, twice over: below 100px a row's ticks are
  // just its own top and bottom, so at 0.32px a row the per-row hatches are two
  // lines per subtrack on the same pixels.
  it('draws none once the rows are too short to rule', () => {
    expect(
      hatchYs(
        render(
          makeModel({
            showCrossHatches: true,
            ticks,
            effectiveRowHeight: 0.32,
            numRows: 1987,
          }),
        ),
      ),
    ).toEqual([])
  })

  it('draws none without ticks or with the setting off', () => {
    expect(hatchYs(render(makeModel({ showCrossHatches: true })))).toEqual([])
    expect(
      hatchYs(render(makeModel({ showCrossHatches: false, ticks }))),
    ).toEqual([])
  })
})
