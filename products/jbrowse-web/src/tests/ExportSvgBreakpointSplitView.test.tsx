import {
  createView,
  exportAndVerifySvg,
  setupExportSvgTest,
  sleep,
} from './util'
import breakpointConfig from '../../test_data/breakpoint/config.json'

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setupExportSvgTest(url => require.resolve(`../../test_data/breakpoint/${url}`))

const delay = { timeout: 50000 }

test('export svg of breakpoint split view', async () => {
  console.warn = jest.fn()
  const { findByTestId, findAllByText, findByText } =
    await createView(breakpointConfig)

  await sleep(10000)

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'breakpoint_split_view',
    delay,
    findAllByText,
  })
}, 60000)
