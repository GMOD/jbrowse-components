import './svgExportMocks.ts'

import { waitFor } from '@testing-library/react'

import breakpointConfig from '../../test_data/breakpoint/config.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  mockConsoleWarn,
  setup,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

const delay = { timeout: 50000 }

test('export svg of breakpoint split view', async () => {
  await mockConsoleWarn(async () => {
    doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
    const { findByTestId, findAllByText, findByText, findAllByTestId } =
      await createView(breakpointConfig)

    // Wait for both alignment displays (one per view) to finish rendering
    await waitFor(async () => {
      const done = await findAllByTestId(
        'display-pacbio_hg002_breakpoints-LinearAlignmentsDisplay-done',
        {},
        delay,
      )
      expect(done.length).toBe(2)
    }, delay)

    await exportAndVerifySvg({
      findByTestId,
      findByText,
      filename: 'breakpoint_split_view',
      delay,
      findAllByText,
    })
  })
}, 60000)
