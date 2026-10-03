import { isPerSourceColor } from './rowPalette.ts'
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

// What "Color rows by → Each row" submits.
function eachRow(display: ReturnType<typeof makeDisplay>) {
  display.applyRowEdits(display.editableSources, { field: 'name' })
}

function rowColors(display: ReturnType<typeof makeDisplay>) {
  return display.sources.map(s => s.color)
}

describe('Each row turns the palette on as well as naming the rows', () => {
  it('deals a colour per subtrack, where before it dealt none', () => {
    const display = makeDisplay()
    expect(new Set(rowColors(display)).size).toBe(1)

    eachRow(display)

    expect(isPerSourceColor(display.colorSetting)).toBe(true)
    expect(display.wiggleColor.perSource).toBe(true)
    expect(new Set(rowColors(display)).size).toBe(3)
  })

  it('offers a way back off it', () => {
    const display = makeDisplay()
    eachRow(display)
    expect(display.rowStylingIsCustom).toBe(true)

    display.resetRowArrangement()

    expect(isPerSourceColor(display.colorSetting)).toBe(false)
    expect(display.rowStylingIsCustom).toBe(false)
    expect(new Set(rowColors(display)).size).toBe(1)
  })

  it('takes the switch back off when the reader moves off Each row', () => {
    const display = makeDisplay()
    eachRow(display)

    display.applyRowEdits(display.editableSources, {
      field: 'name',
      scale: 'none',
      domain: [],
      range: [],
    })

    expect(isPerSourceColor(display.colorSetting)).toBe(false)
  })

  it('plots a colour set on one subtrack under None, the rest unchanged', () => {
    const display = makeDisplay()
    const before = rowColors(display)
    const [a, b, c] = display.editableSources

    display.applyRowEdits([a!, { ...b!, color: '#123456' }, c!], {
      field: 'name',
      unknown: '',
    })

    expect(isPerSourceColor(display.colorSetting)).toBe(false)
    expect(rowColors(display)).toEqual([before[0], '#123456', before[2]])
  })
})

describe('where the switch would be wrong, the row colour goes alone', () => {
  // Under a fade the switch deals nothing to an ungrouped subtrack and takes
  // the pair the fade runs on with it — four shipped CNV figures read that.
  it('leaves a gradient alone', () => {
    const display = makeDisplay({ renderingType: 'density' })
    const before = display.wiggleColor

    eachRow(display)

    expect(display.scoreGradientPaints).toBe(true)
    expect(isPerSourceColor(display.colorSetting)).toBe(false)
    expect(display.wiggleColor).toEqual(before)
  })

  // The switch makes the negative side take the positive colour, so a lone
  // BigWig would lose the red below its baseline.
  it('leaves one subtrack alone', () => {
    const display = makeDisplay({ names: ['a'], rows: false })
    const before = display.wiggleColor

    eachRow(display)

    expect(isPerSourceColor(display.colorSetting)).toBe(false)
    expect(display.wiggleColor).toEqual(before)
  })

  // A config that asked for a colour per subtrack keeps it, whatever a submit
  // under a gradient would have wanted.
  it('keeps a colour per subtrack the config declared', () => {
    const display = makeDisplay({
      renderingType: 'density',
      displayConfig: { color: { field: 'source', scale: 'categorical' } },
    })

    display.applyRowEdits(display.editableSources, {
      field: 'name',
      scale: 'none',
      domain: [],
      range: [],
    })

    expect(isPerSourceColor(display.colorSetting)).toBe(true)
    expect(display.rowStylingIsCustom).toBe(false)
  })
})

// A drag passes no colour object, so the config's own stands.
it('a reorder writes no colour', () => {
  const display = makeDisplay()

  display.applyRowEdits([...display.editableSources].reverse())

  expect(isPerSourceColor(display.colorSetting)).toBe(false)
})

// The dialog opens on what is drawn: Each row only while the palette deals the
// subtracks a colour each, and an untouched submit sends no colour object.
describe('the choice the dialog opens on', () => {
  it('reads None while every subtrack draws one colour, and an untouched OK leaves it', () => {
    const display = makeDisplay()
    expect(display.rowPaletteDeals).toBe(true)
    expect(display.rowColorChoice).toBe('')

    display.applyRowEdits(display.editableSources)

    expect(isPerSourceColor(display.colorSetting)).toBe(false)
    expect(display.rowColorChoice).toBe('')
  })

  it('reads Each row once the palette is on, and an untouched OK keeps it on', () => {
    const display = makeDisplay()
    eachRow(display)
    expect(display.rowColorChoice).toBe('name')

    display.applyRowEdits(display.editableSources)

    expect(isPerSourceColor(display.colorSetting)).toBe(true)
  })

  it('reads Each row over the palette an overlay deals unasked', () => {
    const display = makeDisplay({ rows: false })
    expect(new Set(rowColors(display)).size).toBe(3)
    expect(display.rowColorChoice).toBe('name')
  })

  it('offers no Each row where it can turn nothing on', () => {
    expect(makeDisplay({ renderingType: 'density' }).rowPaletteDeals).toBe(
      false,
    )
    const one = makeDisplay({
      names: ['a'],
      displayConfig: { color: { field: 'source', scale: 'categorical' } },
    })
    expect(one.rowPaletteDeals).toBe(false)
    expect(one.rowColorChoice).toBe('')
  })
})

describe("rowColor's unknown", () => {
  it('greys the subtracks the pairs leave out, the listed one keeping its pair', () => {
    const display = makeDisplay({
      displayConfig: {
        color: { field: 'source', scale: 'categorical' },
        rowColor: { domain: ['b'], range: ['#123456'], unknown: '#cccccc' },
      },
    })

    expect(rowColors(display)).toEqual(['#cccccc', '#123456', '#cccccc'])
  })
})
