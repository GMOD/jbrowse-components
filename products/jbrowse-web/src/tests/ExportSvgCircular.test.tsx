import userEvent from '@testing-library/user-event'

import { createView, exportAndVerifySvg, hts, setupExportSvgTest } from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setupExportSvgTest()

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of circular', async () => {
  const user = userEvent.setup()
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  await user.click(await findByText('File', ...opts))
  await user.click(await findByText(/Open track/, ...opts))
  await user.click(await findByText('Open', ...opts))

  await user.click(await findByTestId('circular_track_select', ...opts))
  await user.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'circular',
    delay,
  })
}, 45000)
