import './svgExportMocks.ts'

import { saveAs } from '@jbrowse/core/util'
import { fireEvent, waitFor } from '@testing-library/react'

import volvoxConfig from '../../test_data/volvox/config.json' with { type: 'json' }
import { generateReadBuffer, volvoxGetFile } from './generateReadBuffer.ts'
import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  getSavedSvg,
  hts,
  mockFile404,
  setup,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

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

test('export svg of circular renders error when track fails to load', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockFile404('volvox.dup.vcf.gz', generateReadBuffer(volvoxGetFile))
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
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

  // export completes (does not hang) and renders the error hatch circle
  // instead of chords
  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, delay)
  const svg = getSavedSvg()
  expect(svg).toContain('#ef5350')
  expect(svg).not.toContain('structuralVariantChordRenderer')
  jest.restoreAllMocks()
}, 45000)
