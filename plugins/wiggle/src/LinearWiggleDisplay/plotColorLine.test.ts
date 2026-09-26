import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { plotColorEdit, plotColorLine } from './plotColorLine.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

// Driven off a real display rather than a hand-built ResolvedWiggleColor: what
// the line shows is whatever `wiggleColor` resolved, layout default included,
// and a stand-in would restate the resolution this is checking.
function makeDisplay({
  names = ['a', 'b'],
  rows = true,
  color,
  origin,
  renderingType,
}: {
  names?: string[]
  rows?: boolean
  color?: Record<string, unknown> | string
  origin?: number
  renderingType?: string
} = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRowLayout(rows)
  display.setRpcData(
    0,
    { sources: names.map(makeSource) },
    view.displayedRegions[0],
  )
  if (color !== undefined) {
    display.setColor(color)
  }
  if (origin !== undefined) {
    display.setOrigin(origin)
  }
  if (renderingType) {
    display.setRenderingType(renderingType)
  }
  return display
}

// The whole contract in one call: read the line, write it back unchanged, and
// the colours the plot paints have not moved.
function roundTrips(display: ReturnType<typeof makeDisplay>) {
  const before = plotColorLine(display.wiggleColor)
  display.setColor(plotColorEdit(display.colorSetting, before))
  return { before, after: plotColorLine(display.wiggleColor) }
}

describe('what the line reads out', () => {
  it('shows the pair the layout paints where nothing is written', () => {
    expect(plotColorLine(makeDisplay().wiggleColor)).toEqual({
      above: WIGGLE_POS_COLOR_DEFAULT,
      below: WIGGLE_NEG_COLOR_DEFAULT,
      cut: 0,
      mode: 'edit',
    })
  })

  it('shows one colour twice for a constant, which is what a flat plot is', () => {
    expect(
      plotColorLine(makeDisplay({ color: '#C8B414' }).wiggleColor),
    ).toEqual({ above: '#C8B414', below: '#C8B414', cut: 0, mode: 'edit' })
  })

  it('reads a threshold pair out in the order the range holds it', () => {
    const display = makeDisplay({
      color: {
        field: 'score',
        scale: 'threshold',
        range: ['#2166ac', '#b2182b'],
      },
    })

    expect(plotColorLine(display.wiggleColor)).toMatchObject({
      above: '#b2182b',
      below: '#2166ac',
      mode: 'edit',
    })
  })

  // The cut follows the origin until a domain names one, so the line has to
  // say where the colour actually changes rather than print a zero.
  it('names the origin as the cut where the domain declares none', () => {
    expect(plotColorLine(makeDisplay({ origin: 2 }).wiggleColor).cut).toBe(2)
    expect(
      plotColorLine(
        makeDisplay({
          origin: 2,
          color: { field: 'score', scale: 'threshold', domain: ['5'] },
        }).wiggleColor,
      ).cut,
    ).toBe(5)
  })

  // Density reads the same pair as the two ends of its white fade, so the line
  // is the whole colour story there too — it is not a gradient.
  it('still edits in density, where the pair is the fade\u2019s two ends', () => {
    const display = makeDisplay({
      renderingType: 'density',
      color: {
        field: 'score',
        scale: 'threshold',
        range: ['#2166ac', '#b2182b'],
      },
    })

    expect(display.scoreGradientPaints).toBe(true)
    expect(plotColorLine(display.wiggleColor)).toMatchObject({
      above: '#b2182b',
      mode: 'edit',
    })
  })
})

describe('what the line declines to edit, and why', () => {
  it('reads out a ramp without offering to replace it', () => {
    const display = makeDisplay({
      color: { field: 'score', scale: 'linear', scheme: 'viridis' },
    })

    expect(plotColorLine(display.wiggleColor)).toMatchObject({
      mode: 'read',
      reason: 'a gradient paints this plot',
    })
  })

  it('hides itself where a colour per subtrack paints', () => {
    const display = makeDisplay({ rows: false })

    expect(display.wiggleColor.perSource).toBe(true)
    expect(plotColorLine(display.wiggleColor).mode).toBe('hide')
  })

  // Two swatches cannot say four bands, and writing them would drop the two in
  // the middle.
  it('reads out a multi-cut threshold without offering to replace it', () => {
    const display = makeDisplay({
      color: {
        field: 'score',
        scale: 'threshold',
        domain: ['2', '5', '8'],
        range: ['#111111', '#222222', '#333333', '#444444'],
      },
    })

    expect(display.wiggleColor.cuts).toHaveLength(3)
    expect(plotColorLine(display.wiggleColor)).toMatchObject({
      mode: 'read',
      reason: '3 cuts, a colour each',
    })
  })
})

describe('what a swatch writes', () => {
  it('writes the string form where both sides are one colour', () => {
    const display = makeDisplay()

    expect(
      plotColorEdit(display.colorSetting, { above: 'green', below: 'green' }),
    ).toBe('green')
  })

  it('parts a constant into a pair when the sides differ', () => {
    const display = makeDisplay({ color: '#C8B414' })

    expect(
      plotColorEdit(display.colorSetting, {
        above: '#C8B414',
        below: '#123456',
      }),
    ).toEqual({
      field: 'score',
      scale: 'threshold',
      range: ['#123456', '#C8B414'],
    })
  })

  // What the nine shipped threshold figures hold: a range and no domain. A
  // `domain` written here would pin the cut at today's origin on every one of
  // them.
  it('leaves an undeclared cut undeclared, so it keeps following the origin', () => {
    const display = makeDisplay({
      origin: 2,
      color: {
        field: 'score',
        scale: 'threshold',
        range: ['#2166ac', '#b2182b'],
      },
    })

    const written = plotColorEdit(display.colorSetting, {
      above: '#b2182b',
      below: '#2166ac',
    })
    expect(written).not.toHaveProperty('domain')

    display.setColor(written)
    display.setOrigin(3)
    expect(plotColorLine(display.wiggleColor).cut).toBe(3)
  })

  it('keeps a declared cut', () => {
    const display = makeDisplay({
      color: { field: 'score', scale: 'threshold', domain: ['2'] },
    })

    expect(
      plotColorEdit(display.colorSetting, {
        above: '#b2182b',
        below: '#2166ac',
      }),
    ).toEqual({
      field: 'score',
      scale: 'threshold',
      domain: ['2'],
      range: ['#2166ac', '#b2182b'],
    })
  })
})

// The one assertion the whole line rests on: every state a shipped config
// holds survives being read into the line and written straight back.
describe('a round trip changes nothing', () => {
  it.each([
    ['nothing written', {}],
    ['a constant', { color: '#C8B414' }],
    [
      'a threshold pair',
      {
        color: {
          field: 'score',
          scale: 'threshold',
          range: ['#2166ac', '#b2182b'],
        },
      },
    ],
    [
      'a threshold pair about a declared cut',
      {
        color: { field: 'score', scale: 'threshold', domain: ['2'] },
        origin: 2,
      },
    ],
    [
      'a threshold pair in density',
      {
        renderingType: 'density',
        color: {
          field: 'score',
          scale: 'threshold',
          range: ['#2166ac', '#b2182b'],
        },
      },
    ],
  ])('%s', (_name, args) => {
    const { before, after } = roundTrips(makeDisplay(args))

    expect(after).toEqual(before)
  })
})
