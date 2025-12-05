import { fireEvent } from '@testing-library/react'

import { createView, exportAndVerifySvg, hts, setupExportSvgTest } from './util'

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setupExportSvgTest()

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of lgv', async () => {
  const { view, findByTestId, findByText } = await createView()

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  await exportAndVerifySvg({ findByTestId, findByText, filename: 'lgv', delay })
}, 45000)
