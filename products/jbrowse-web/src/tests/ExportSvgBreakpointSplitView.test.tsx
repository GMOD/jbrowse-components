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
    const { findByTestId, findAllByText, findByText } =
      await createView(breakpointConfig)

    // Wait for both alignment displays (one per view) to finish rendering
    await waitFor(async () => {
      // by display id, not testid: both views' alignments displays share the
      // `pileup-display-done` base, and this test is specifically counting them
      const done = document.querySelectorAll(
        '[data-display-id="pacbio_hg002_breakpoints-LinearAlignmentsDisplay"][data-display-drawn="true"]',
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
