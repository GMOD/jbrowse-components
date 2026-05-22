import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  mockConsoleWarn,
  setup,
} from './util.tsx'
import breakpointConfig from '../../test_data/breakpoint/config.json' with { type: 'json' }


import './svgExportMocks'
jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

const delay = { timeout: 50000 }

test('export svg of breakpoint split view', async () => {
  await mockConsoleWarn(async () => {
    doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
    const { findByTestId, findAllByText, findByText } =
      await createView(breakpointConfig)

    // TODO: replace with waitFor once a suitable render-complete selector exists
    await new Promise(resolve => setTimeout(resolve, 10000))

    await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename: 'breakpoint_split_view',
      delay,
      findAllByText,
    })
  })
}, 60000)
