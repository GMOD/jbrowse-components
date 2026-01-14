import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  hts,
  setup,
} from './util.tsx'

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

  // Wait for the canvas to render first
  await findByTestId(/prerendered_canvas.*done/, {}, { timeout: 30000 })

  await exportAndVerifySvg({
    findByTestId,
    findByText,
    filename: 'reversed_region_labels',
    delay,
  })
}, 60000)
