import './svgExportMocks.ts'

import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
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

test('export svg of reversed region with gene labels', async () => {
  const { view, findByTestId, findByText } = await createView()

  // Navigate to reversed region
  await view.navToLocString('ctgA:1..7,720[rev]', 'volvox')

  // Wait for navigation to complete
  await waitFor(
    () => {
      expect(view.displayedRegions[0]?.reversed).toBe(true)
    },
    { timeout: 10000 },
  )

  // Open gff3tabix_genes track which has labels
  fireEvent.click(await findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for at least one canvas block to finish rendering
  await screen.findAllByTestId(/^display-.*-done$/, {}, { timeout: 30000 })

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'reversed_region_labels',
    delay,
  })
}, 60000)
