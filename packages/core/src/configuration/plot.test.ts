import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { setConf } from './getConf.ts'
import {
  liftPlot,
  parsePlot,
  plotKeysOf,
  plotList,
  plotOf,
  plotWrites,
  schemaPlotProblems,
} from './plot.ts'

const Facet = ConfigurationSchema(
  'PlotTestFacet',
  {
    field: { type: 'string', defaultValue: '' },
    domain: { type: 'stringArray', defaultValue: [] },
  },
  { shorthand: 'field', writes: 'whole', closed: true, plot: true },
)

const Axis = ConfigurationSchema(
  'PlotTestAxis',
  {
    domainMin: { type: 'maybeNumber' },
    domainMax: { type: 'maybeNumber' },
  },
  { closed: true, scaleFence: 'domainQuantile' },
)

const Scales = ConfigurationSchema(
  'PlotTestScales',
  { y: Axis },
  { plot: true },
)

const Mark = ConfigurationSchema('PlotTestMark', {
  mark: { type: 'string', defaultValue: 'bar' },
})

const Display = ConfigurationSchema(
  'PlotTestDisplay',
  {
    height: { type: 'number', defaultValue: 100 },
    facet: Facet,
    scales: Scales,
    filter: { type: 'stringArray', defaultValue: [], plot: true },
    marks: plotList(types.stripDefault(types.array(Mark), [{ mark: 'point' }])),
    rows: types.array(Mark),
  },
  { explicitIdentifier: 'displayId' },
)

const display = (snap: Record<string, unknown> = {}) =>
  Display.create({ displayId: 'd', ...snap })

test("a display's plot keys are the ones it declares a plot setting, in order", () => {
  expect(plotKeysOf(display())).toEqual(['facet', 'scales', 'filter', 'marks'])
})

test('a subclass inherits the flag, and opts out with false', () => {
  const SubFacet = ConfigurationSchema(
    'PlotTestSubFacet',
    {},
    { baseConfiguration: Facet },
  )
  const Unflagged = ConfigurationSchema(
    'PlotTestUnflagged',
    {},
    { baseConfiguration: Facet, plot: false },
  )
  const conf = ConfigurationSchema('PlotTestInherits', {
    facet: SubFacet,
    rowColor: Unflagged,
  }).create()
  expect(plotKeysOf(conf)).toEqual(['facet'])
})

test('the plot is what a config file writes, a shorthand folded back', () => {
  expect(
    plotOf(display({ facet: 'strand', scales: { y: { domainMin: 0 } } })),
  ).toEqual({
    marks: [{ mark: 'point' }],
    facet: 'strand',
    scales: { y: { domainMin: 0 } },
  })
  expect(
    plotOf(display({ facet: { field: 'HP', domain: ['1', '2'] } })).facet,
  ).toEqual({ field: 'HP', domain: ['1', '2'] })
})

test('lifting what the plot shows changes nothing', () => {
  const conf = display({ facet: 'strand', filter: ['jexl:true'] })
  expect(plotOf(liftPlot(conf, plotOf(conf)))).toEqual(plotOf(conf))
})

test('a lift merges a draft over the plot, null resetting a setting', () => {
  const conf = display({ facet: 'strand', filter: ['jexl:true'] })
  const lifted = plotOf(liftPlot(conf, { facet: null, filter: [] }))
  expect(lifted.facet).toBeUndefined()
  expect(lifted.filter).toBeUndefined()
  expect(getSnapshot(conf)).toMatchObject({ facet: { field: 'strand' } })
})

test('a lift throws what a config file is refused for', () => {
  expect(() => liftPlot(display(), { facet: { field: 'x', nope: 1 } })).toThrow(
    'nope',
  )
})

test('the text refuses a key the plot does not hold', () => {
  expect(() => parsePlot('{ "height": 3 }', ['facet'])).toThrow(
    "This display's plot is facet, not height",
  )
  expect(() => parsePlot('[]', ['facet'])).toThrow('one JSON object')
  expect(parsePlot('{ "facet": null }', ['facet'])).toEqual({ facet: null })
})

test('a draft writes only what moved, a namespace member by member', () => {
  const conf = display({ scales: { y: { domainMin: 0, domainMax: 9 } } })
  const draft = {
    ...plotOf(conf),
    scales: { y: { domainMin: 2 } },
    facet: null,
  }
  const writes = plotWrites(conf, draft)
  expect(writes).toEqual({ scales: { y: { domainMin: 2, domainMax: 9 } } })
  for (const [key, value] of Object.entries(writes)) {
    setConf(conf, key as 'scales', value)
  }
  expect(plotOf(conf).scales).toEqual({ y: { domainMin: 2, domainMax: 9 } })
  expect(plotWrites(conf, { scales: { y: { domainMax: null } } })).toEqual({
    scales: { y: { domainMin: 2 } },
  })
})

test('a channel is written whole', () => {
  const conf = display({ facet: { field: 'HP', domain: ['1', '2'] } })
  expect(plotWrites(conf, { facet: { field: 'HP' } })).toEqual({
    facet: 'HP',
  })
})

test('a setting spelled another way but lifting the same writes nothing', () => {
  const conf = display({ facet: 'strand' })
  expect(plotWrites(conf, { facet: { field: 'strand' } })).toEqual({})
  expect(plotWrites(conf, { facet: null })).toEqual({ facet: null })
})

test('a draft naming a setting outside the plot is refused before any write', () => {
  const conf = display()
  expect(() => plotWrites(conf, { facet: 'strand', height: 3 })).toThrow(
    'not height',
  )
  expect(() => liftPlot(conf, { height: 3 })).toThrow('not height')
})

const Color = ConfigurationSchema(
  'PlotTestColor',
  {
    value: {
      type: 'color',
      defaultValue: 'jexl:feature.color',
      contextVariable: ['feature'],
    },
    field: { type: 'string', defaultValue: 'score' },
    scale: ConfigurationSchema(
      'PlotTestColorScale',
      {
        type: { type: 'maybeString' },
        domain: { type: 'stringArray', defaultValue: [] },
        range: { type: 'stringArray', defaultValue: [] },
      },
      { closed: true },
    ),
  },
  {
    closed: true,
    writes: 'whole',
    fieldPresets: { score: { scale: { type: 'threshold' } } },
  },
)

const ColorDisplay = ConfigurationSchema(
  'PlotTestColorDisplay',
  {
    encoding: ConfigurationSchema(
      'PlotTestEncoding',
      { color: Color },
      { closed: true, plot: true },
    ),
    scales: Scales,
  },
  { explicitIdentifier: 'displayId' },
)

test("a lifted plot's color is judged under its schema's presets and defaults, its jexl: value unevaluated, and scales.y by its ends", () => {
  const conf = ColorDisplay.create({ displayId: 'd' })
  expect(schemaPlotProblems(conf)).toEqual([])
  expect(
    schemaPlotProblems(
      liftPlot(conf, {
        encoding: { color: { scale: { domain: ['5', '1'] } } },
        scales: { y: { domainMin: 9, domainMax: 1 } },
      }),
    ),
  ).toEqual([
    expect.stringMatching(
      /^encoding\.color\.scale\.domain: threshold cuts are distinct/,
    ),
    expect.stringMatching(/^scales\.y\.domainMax: domainMax is below/),
  ])
})

const Band = ConfigurationSchema(
  'PlotTestBand',
  {
    encoding: ConfigurationSchema('PlotTestBandEncoding', {
      y: ConfigurationSchema('PlotTestY', {
        scale: ConfigurationSchema(
          'PlotTestYScale',
          {
            domainMin: { type: 'maybeNumber' },
            fenceQuantile: { type: 'number', defaultValue: 1 },
          },
          { closed: true, scaleFence: 'fenceQuantile' },
        ),
      }),
    }),
  },
  { plot: true },
)

test("a band's y channel is judged by its ends under the path that walks to it, naming its own fence slot", () => {
  const BandDisplay = ConfigurationSchema(
    'PlotTestBandDisplay',
    { band: Band },
    { explicitIdentifier: 'displayId' },
  )
  const conf = BandDisplay.create({ displayId: 'd' })
  expect(
    schemaPlotProblems(
      liftPlot(conf, {
        band: { encoding: { y: { scale: { fenceQuantile: 99 } } } },
      }),
    ),
  ).toEqual([
    expect.stringMatching(
      /^band\.encoding\.y\.scale\.fenceQuantile: fenceQuantile is a fraction/,
    ),
  ])
})
