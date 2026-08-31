import './svgExportMocks.ts'

import { saveAs } from '@jbrowse/core/util'
import { fireEvent, waitFor } from '@testing-library/react'

import { generateReadBuffer, volvoxGetFile } from './generateReadBuffer.ts'
import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  mockFile404,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

// the one chord track this file opens - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_sv_test'])

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of circular', async () => {
  const { findByTestId, findByText } = await createView({
    ...config,
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

// A failed track fails the export: the dialog keeps its error banner up and
// nothing is saved. The radial display has no width/height box to host a
// message rect, so baking its bespoke `<DisplayError>` circle into the figure
// would put it there at whatever size it happened to take.
test('export svg of circular fails when a track fails to load', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockFile404('volvox.dup.vcf.gz', generateReadBuffer(volvoxGetFile))
  const { findByTestId, findByText } = await createView({
    ...config,
    defaultSession: {
      name: 'Integration Test Circular Error',
      views: [{ id: 'integration_test_circular_error', type: 'CircularView' }],
    },
  })
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))

  fireEvent.click(await findByTestId('circular_track_select', ...opts))
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  // the export resolves (it must not hang) into the dialog's own error banner
  await findByText(/Cannot export.*HTTP 404/, {}, delay)
  await waitFor(() => {
    expect(saveAs).not.toHaveBeenCalled()
  }, delay)
  jest.restoreAllMocks()
}, 45000)
