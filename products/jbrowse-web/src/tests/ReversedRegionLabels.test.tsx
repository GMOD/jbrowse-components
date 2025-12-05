import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, exportAndVerifySvg, hts, setupExportSvgTest } from './util'

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setupExportSvgTest()

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of reversed region with gene labels', async () => {
  const user = userEvent.setup()
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
  await user.click(await findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the canvas to render first
  await findByTestId(/prerendered_canvas.*done/, {}, { timeout: 30000 })

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'reversed_region_labels',
    delay,
  })
}, 60000)
