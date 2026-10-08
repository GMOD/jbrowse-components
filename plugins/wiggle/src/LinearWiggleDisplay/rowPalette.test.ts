import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'

import { createTestEnvironment, makeSource } from './testEnv.ts'

function makeDisplay({
  names = ['a', 'b', 'c'],
  rows = true,
  renderingType,
  displayConfig,
}: {
  names?: string[]
  rows?: boolean
  renderingType?: string
  displayConfig?: Record<string, unknown>
} = {}) {
  const { createDisplay } = createTestEnvironment({ displayConfig })
  const { display, view } = createDisplay()
  display.setRowLayout(rows)
  display.setRpcData(
    0,
    { sources: names.map(makeSource) },
    view.displayedRegions[0],
  )
  if (renderingType) {
    display.setRenderingType(renderingType)
  }
  return display
}

function rowColors(display: ReturnType<typeof makeDisplay>) {
  return display.markSources.map(s => s.color)
}

const TABLEAU = [0, 1, 2].map(rowPaletteColorAt)

describe('an overlay of several subtracks deals tableau10 by name', () => {
  it('deals each subtrack a color, painted on both sides of the cut', () => {
    const display = makeDisplay({ rows: false })
    expect(display.sharesPanel).toBe(true)
    expect(display.rowPaletteDeals).toBe(true)
    expect(rowColors(display)).toEqual(TABLEAU)
    expect(display.rowPaletteDeals).toBe(true)
    expect(display.rowColorChoice).toBe('name')
  })

  it('deals nothing under None, every subtrack in the plot color', () => {
    const display = makeDisplay({
      rows: false,
      displayConfig: { rowColor: { unknown: '' } },
    })
    expect(rowColors(display)).toEqual([undefined, undefined, undefined])
    expect(display.rowColorChoice).toBe('')
  })

  it("greys the subtracks rowColor's pairs leave out under its unknown", () => {
    const display = makeDisplay({
      rows: false,
      displayConfig: {
        rowColor: { domain: ['b'], range: ['#123456'], unknown: '#cccccc' },
      },
    })
    expect(rowColors(display)).toEqual(['#cccccc', '#123456', '#cccccc'])
  })

  // A declared color paints the plot, so nothing deals over it.
  it('deals nothing over a declared color', () => {
    const display = makeDisplay({
      rows: false,
      displayConfig: { color: 'darkgreen' },
    })
    expect(display.rowPaletteDeals).toBe(false)
    expect(display.rowPaletteDeals).toBe(false)
    expect(rowColors(display)).toEqual([undefined, undefined, undefined])
  })

  it('deals nothing while a gradient paints', () => {
    const display = makeDisplay({ rows: false, renderingType: 'density' })
    expect(display.rowPaletteDeals).toBe(false)
    expect(display.rowColorChoice).toBe('')
  })
})

// A lone plot has nothing to be told apart from, so it keeps the red below its
// baseline.
it('a lone subtrack keeps the pos/neg pair', () => {
  const display = makeDisplay({ names: ['a'], rows: false })
  expect(display.sharesPanel).toBe(false)
  expect(display.rowPaletteDeals).toBe(false)
  expect(rowColors(display)).toEqual([undefined])
})

// Each subtrack has a row of its own, so each draws in the plot color unless
// rowColor or the file gives it one.
describe('a row per subtrack deals no palette', () => {
  it('draws every row in the plot color', () => {
    const display = makeDisplay()
    expect(display.rowPaletteDeals).toBe(false)
    expect(rowColors(display)).toEqual([undefined, undefined, undefined])
    expect(display.rowColorChoice).toBe('')
  })

  it('paints a row rowColor or the file gives a color', () => {
    const display = makeDisplay({
      names: [],
      displayConfig: { rowColor: { domain: ['b'], range: ['#123456'] } },
    })
    display.setRpcData(
      0,
      {
        sources: [
          makeSource('a'),
          makeSource('b'),
          { ...makeSource('c'), color: '#0c0c0c' },
        ],
      },
      display.host.displayedRegions[0]!,
    )
    expect(rowColors(display)).toEqual([undefined, '#123456', '#0c0c0c'])
  })

  it('plots a color set on one subtrack, the rest unchanged', () => {
    const display = makeDisplay()
    display.applyRowEdits(display.editableSources, {
      domain: ['b'],
      range: ['#123456'],
    })
    expect(rowColors(display)).toEqual([undefined, '#123456', undefined])
    expect(display.rowColorChoice).toBe('name')
  })
})

// A drag passes no color object, so the config's own stands.
it('a reorder writes no color', () => {
  const display = makeDisplay({ rows: false })
  display.applyRowEdits([...display.editableSources].reverse())
  expect(display.rowStylingIsCustom).toBe(false)
  expect(display.markSources.map(s => s.color)).toEqual([...TABLEAU].reverse())
})
