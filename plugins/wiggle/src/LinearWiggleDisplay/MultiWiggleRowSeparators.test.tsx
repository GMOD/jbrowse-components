import { renderToString } from 'react-dom/server'

import MultiWiggleRowSeparators from './MultiWiggleRowSeparators.tsx'

function makeModel(overrides: Partial<Parameters<typeof render>[0]> = {}) {
  return {
    isOverlay: false,
    isDensityMode: false,
    showRowSeparators: true,
    numRows: 3,
    effectiveRowHeight: 30,
    ...overrides,
  }
}

function render(model: {
  isOverlay: boolean
  isDensityMode: boolean
  showRowSeparators: boolean
  numRows: number
  effectiveRowHeight: number
}) {
  return renderToString(
    <svg>
      <MultiWiggleRowSeparators model={model} width={800} />
    </svg>,
  )
}

// The separator hairline follows the theme's divider color through
// getStrokeProps, which splits the alpha onto its own attribute.
function separatorYs(svg: string) {
  return [...svg.matchAll(/<line x1="0" y1="([\d.]+)"/g)].map(m => Number(m[1]))
}
function strokeOpacity(svg: string) {
  return Number(/stroke-opacity="([\d.]+)"/.exec(svg)?.[1])
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
