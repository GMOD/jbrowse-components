import { readConfObject } from '@jbrowse/core/configuration'

import { MANHATTAN_PLOT_EXAMPLES } from './plotExamples.ts'
import { createTestEnvironment } from './testEnv.ts'

const plotOf = (description: string) =>
  JSON.parse(
    MANHATTAN_PLOT_EXAMPLES.find(e => e.description === description)!.plot,
  )

test('the axis-following example resets the y scale and keeps the color', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.applyPlot(plotOf('the axis from 0 to 20'))
  display.applyPlot({ encoding: { color: { value: '#c951c9' } } })
  display.applyPlot(plotOf('the axis following the data'))
  const { configuration } = display
  expect(
    readConfObject(configuration, ['encoding', 'y', 'scale', 'domainMax']),
  ).toBeUndefined()
  expect(readConfObject(configuration, ['encoding', 'color'])).toMatchObject({
    value: '#c951c9',
  })
})
