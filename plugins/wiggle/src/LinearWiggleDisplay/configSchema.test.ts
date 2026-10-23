import {
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

function create(snap: Record<string, unknown>) {
  return configSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
    ...snap,
  })
}

const COLOR = ['encoding', 'color'] as const
const SCALE = [...COLOR, 'scale'] as const
const Y = ['encoding', 'y'] as const

test('value is the constant, and a bare color is refused with its spelling', () => {
  const conf = create({ encoding: { color: { value: 'green' } } })
  expect(readConfObject(conf, [...COLOR, 'value'])).toBe('green')
  expect(() => create({ encoding: { color: 'green' } })).toThrow(
    'write encoding.color: { "value": "green" }',
  )
})

test("v4's display color is the channel's constant", () => {
  const conf = create({ color: 'darkgreen' })
  expect(readConfObject(conf, [...COLOR, 'value'])).toBe('darkgreen')
})

// The channel colors the score it plots, and a subtrack's color is
// `rowColor`'s, so it names no field at all.
test('the channel takes no field', () => {
  for (const field of ['score', 'source']) {
    expect(() =>
      refusingUndeclaredKeys(() => create({ encoding: { color: { field } } })),
    ).toThrow('WiggleColor takes')
  }
})

test('the channel carries the scale and the slots it reads', () => {
  const conf = create({
    encoding: {
      color: {
        scale: {
          type: 'threshold',
          domain: [2],
          range: ['#2166ac', '#b2182b'],
          names: ['loss', 'gain'],
        },
        legend: { title: 'log2 ratio' },
      },
    },
  })
  expect(readConfObject(conf, [...SCALE, 'type'])).toBe('threshold')
  expect(readConfObject(conf, [...SCALE, 'domain'])).toEqual(['2'])
  expect(readConfObject(conf, [...SCALE, 'range'])).toEqual([
    '#2166ac',
    '#b2182b',
  ])
  expect(readConfObject(conf, [...SCALE, 'names'])).toEqual(['loss', 'gain'])
  expect(readConfObject(conf, [...COLOR, 'legend', 'title'])).toBe('log2 ratio')
})

test('a write refuses an undeclared key by name', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      create({ encoding: { color: { scale: { pivot: 2 } } } }),
    ),
  ).toThrow('WiggleColorScale takes')
})

test('a scale the display does not paint is refused', () => {
  expect(() =>
    create({ encoding: { color: { scale: { type: 'ordinal' } } } }),
  ).toThrow()
})

test('the legend is on unless the config turns it off', () => {
  expect(readConfObject(create({}), ['legend', 'show'])).toBe(true)
  expect(
    readConfObject(create({ legend: { show: false } }), ['legend', 'show']),
  ).toBe(false)
})

test("v4's rendering names load as the mark they draw, and an unknown one as the default", () => {
  const read = (defaultRendering: string) => {
    const conf = create({ defaultRendering })
    return [
      readConfObject(conf, ['mark', 'type']),
      readConfObject(conf, ['mark', 'interpolate']),
    ]
  }
  expect(read('xyplot')).toEqual(['bar', 'step'])
  expect(read('scatter')).toEqual(['point', 'step'])
  expect(read('density')).toEqual(['span', 'step'])
  expect(read('line')).toEqual(['line', 'step'])
  expect(read('linecenter')).toEqual(['line', 'linear'])
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  expect(read('multixyplot')).toEqual(['bar', 'step'])
  expect(warn).toHaveBeenCalledWith(
    'LinearWiggleDisplay has no rendering "multixyplot": drawing the default mark',
  )
  warn.mockRestore()
  expect(read('point')).toEqual(['point', 'step'])
  expect(readConfObject(create({ mark: 'point' }), ['mark', 'type'])).toBe(
    'point',
  )
  expect(
    readConfObject(create({ mark: { type: 'point' } }), ['mark', 'type']),
  ).toBe('point')
})

test('the old cross hatch flag lands on the axis beside a channel the config writes, and minimal ticks go', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = create({
    displayCrossHatches: true,
    minimalTicks: true,
    encoding: { y: { scale: { type: 'log' } } },
  })
  expect(readConfObject(conf, [...Y, 'axis', 'grid'])).toBe(true)
  expect(readConfObject(conf, [...Y, 'scale', 'type'])).toBe('log')
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test("an early v5 scales.y and y land on encoding.y under the channel's names", () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = create({
    y: 'maxScore',
    scales: {
      y: {
        type: 'symlog',
        domainMin: 1,
        domainQuantile: 1,
        symlogConstant: 2,
        autoscaleGroup: 'depth',
        title: 'signal',
        grid: true,
        minimalTicks: true,
        rules: [30],
      },
    },
  })
  expect(readConfObject(conf, [...Y, 'field'])).toBe('maxScore')
  expect(readConfObject(conf, [...Y, 'scale', 'type'])).toBe('symlog')
  expect(readConfObject(conf, [...Y, 'scale', 'domainMin'])).toBe(1)
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(1)
  expect(readConfObject(conf, [...Y, 'scale', 'constant'])).toBe(2)
  expect(readConfObject(conf, [...Y, 'scale', 'group'])).toBe('depth')
  expect(readConfObject(conf, [...Y, 'axis', 'title'])).toBe('signal')
  expect(readConfObject(conf, [...Y, 'axis', 'grid'])).toBe(true)
  expect(conf.encoding.y.rules.map(r => readConfObject(r, 'value'))).toEqual([
    30,
  ])
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test('a v5 scales.y beats the v4 keys it overlaps', () => {
  const conf = create({
    scaleType: 'log',
    displayCrossHatches: false,
    autoscale: 'local',
    scales: { y: { type: 'linear', grid: true, domainQuantile: 0.9 } },
  })
  expect(readConfObject(conf, [...Y, 'scale', 'type'])).toBe('linear')
  expect(readConfObject(conf, [...Y, 'axis', 'grid'])).toBe(true)
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(0.9)
})

test('a bare encoding.y is the field, and the fence starts at 0.99', () => {
  const conf = create({ encoding: { y: 'minScore' } })
  expect(readConfObject(conf, [...Y, 'field'])).toBe('minScore')
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(0.99)
})

test.each([
  [{ scales: { y: { type: 'log', domainMin: 1 } } }, ['scale', 'type'], 'log'],
  [{ scaleType: 'log' }, ['scale', 'type'], 'log'],
  [{ displayCrossHatches: true }, ['axis', 'grid'], true],
])(
  'a retired y setting lands beside a bare encoding.y: %j',
  (retired, path, value) => {
    const conf = create({ encoding: { y: 'maxScore' }, ...retired })
    expect(readConfObject(conf, [...Y, 'field'])).toBe('maxScore')
    expect(readConfObject(conf, [...Y, ...path])).toBe(value)
  },
)

describe('the slots v4 declared on the display', () => {
  const y = (
    snap: Record<string, unknown>,
    slot: 'domainMin' | 'domainMax' | 'type' | 'fenceQuantile',
  ) => readConfObject(create(snap), [...Y, 'scale', slot])

  test('a fixed range and a log scale reach encoding.y, with no warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const v4 = { minScore: 0, maxScore: 50, scaleType: 'log' }
    expect(y(v4, 'domainMin')).toBe(0)
    expect(y(v4, 'domainMax')).toBe(50)
    expect(y(v4, 'type')).toBe('log')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test("v4's unset sentinels leave the range to the data", () => {
    const unset = { minScore: Number.MIN_VALUE, maxScore: Number.MAX_VALUE }
    expect(y(unset, 'domainMin')).toBe(y({}, 'domainMin'))
    expect(y(unset, 'domainMax')).toBe(y({}, 'domainMax'))
  })

  test('autoscale follows the extremes, as v4 did', () => {
    expect(y({ autoscale: 'local' }, 'fenceQuantile')).toBe(1)
  })

  test('a slot with no successor is let go without a warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    create({ numStdDev: 3, inverted: true })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  // v4 drew its two colors solid on bars and as a white fade on density, so
  // the lift is the pair with no scale, which each mark draws as v4 did.
  test('v4 posColor and negColor lift to the pair, with no scale', () => {
    const conf = create({
      renderers: { DensityRenderer: { posColor: 'red', negColor: 'blue' } },
    })
    expect(readConfObject(conf, [...SCALE, 'type'])).toBeUndefined()
    expect(readConfObject(conf, [...SCALE, 'range'])).toEqual(['blue', 'red'])
  })

  test("a v4 DensityRenderer's one color is the pair it faded to", () => {
    const conf = create({ renderers: { DensityRenderer: { color: 'green' } } })
    expect(readConfObject(conf, [...COLOR, 'value'])).toBeUndefined()
    expect(readConfObject(conf, [...SCALE, 'range'])).toEqual([
      'green',
      'green',
    ])
  })

  test("a renderers block gives the display its renderer's color", () => {
    const conf = create({
      renderers: { XYPlotRenderer: { color: 'purple', filled: false } },
    })
    expect(readConfObject(conf, [...COLOR, 'value'])).toBe('purple')
  })
})

test.each([
  [{ summaryScoreMode: 'avg' }, 'score', 'none'],
  [{ summaryScoreMode: 'min' }, 'minScore', 'none'],
  [{ summaryScoreMode: 'whiskers' }, 'score', 'min-max'],
  [
    { renderers: { XYPlotRenderer: { summaryScoreMode: 'max' } } },
    'maxScore',
    'none',
  ],
])('v4’s %j is y %s, extent %s', (v4, y, extent) => {
  const conf = create(v4)
  expect(readConfObject(conf, [...Y, 'field'])).toBe(y)
  expect(readConfObject(conf, 'extent')).toBe(extent)
})

test('a v4 renderers block keeps its color beside its summary mode', () => {
  const conf = create({
    renderers: { XYPlotRenderer: { summaryScoreMode: 'max', color: 'red' } },
  })
  expect(readConfObject(conf, [...Y, 'field'])).toBe('maxScore')
  expect(readConfObject(conf, [...COLOR, 'value'])).toBe('red')
})
