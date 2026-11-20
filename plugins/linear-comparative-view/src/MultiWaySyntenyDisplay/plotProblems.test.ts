import { parsePlot, readConfObject } from '@jbrowse/core/configuration'

import { MULTI_WAY_PLOT_EXAMPLES } from './plotExamples.ts'
import { createDisplay, createDisplayWithSession } from './testEnv.ts'

const exampleOf = (description: string) =>
  MULTI_WAY_PLOT_EXAMPLES.find(e => e.description === description)!.plot

const paintedFields = (display: ReturnType<typeof createDisplay>) => [
  display.geneColorField,
  display.ribbonColorField,
]

test.each(MULTI_WAY_PLOT_EXAMPLES)(
  'the example $plot parses, passes and applies',
  ({ plot }) => {
    const display = createDisplay()
    const draft = parsePlot(plot, display.plotKeys)
    expect(display.plotProblems(draft)).toEqual([])
    display.applyPlot(draft)
    expect(display.plotWrites(draft)).toEqual({})
  },
)

test.each(
  MULTI_WAY_PLOT_EXAMPLES.filter(e => e.description !== 'the default colors'),
)('the example $plot paints a field the default does not', ({ plot }) => {
  const display = createDisplay()
  const before = paintedFields(display)
  display.applyPlot(parsePlot(plot, display.plotKeys))
  expect(paintedFields(display)).not.toEqual(before)
})

test('the default colors example resets the colors and keeps the other ribbon settings', () => {
  // the schema's own rows.field, so the plot holds only what the test writes
  const { display } = createDisplayWithSession({ laneField: 'auto' })
  display.applyPlot({
    encoding: { color: 'cluster' },
    ribbons: {
      encoding: { color: 'identity', opacity: 0.6 },
      mark: { interpolate: 'bump' },
    },
  })
  display.applyPlot(
    parsePlot(exampleOf('the default colors'), display.plotKeys),
  )
  expect(display.plot).toEqual({
    ribbons: { encoding: { opacity: 0.6 }, mark: { interpolate: 'bump' } },
  })
  expect(
    readConfObject(display.configuration, ['ribbons', 'mark', 'interpolate']),
  ).toBe('bump')
})

test("the gene color's threshold cuts are judged as every color object's are", () => {
  expect(
    createDisplay().plotProblems({
      encoding: {
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: ['5', '1'] },
        },
      },
    }),
  ).toEqual([
    'encoding.color.scale.domain: threshold cuts are distinct numbers, read in ascending order, with the range running from the lowest interval; a repeated cut leaves an interval no value falls in',
  ])
  expect(
    createDisplay().plotProblems({
      encoding: {
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: ['1', '5'], range: ['red'] },
        },
      },
    }),
  ).toEqual([
    'encoding.color.scale.range: 2 threshold cuts make 3 intervals, one color each, and range lists 1: a missing color samples the scheme, else the default ramp, and an extra one is never read',
  ])
})

test("the ribbon color's names are judged under its own setting", () => {
  expect(
    createDisplay().plotProblems({
      ribbons: {
        encoding: {
          color: {
            field: 'group',
            scale: { domain: ['core'], names: ['a', 'b'] },
          },
        },
      },
    }),
  ).toEqual([
    'ribbons.encoding.color.scale.names: names gives one value each its name in the key, and 2 names meet 1 value: a name past them names nothing',
  ])
  expect(
    createDisplay().plotProblems({
      ribbons: {
        encoding: {
          color: {
            field: 'group',
            scale: { domain: ['core'], names: ['Core'] },
          },
        },
      },
    }),
  ).toEqual([])
})
