import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  setup,
} from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of circular', async () => {
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))

  fireEvent.click(await findByTestId('circular_track_select', ...opts))
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'circular',
    delay,
  })
}, 45000)
