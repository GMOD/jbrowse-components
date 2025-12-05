import { fireEvent } from '@testing-library/react'

import { createView, hts, setupTest, waitForCanvasSnapshot } from './util'

setupTest()

const delay = { timeout: 20000 }
const opts = [{}, delay] as const

test('renders peptide letters on CDS features', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  await view.navToLocString('ctgA:3,292..3,323')

  // Enable Color by CDS
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText(/Color by CDS/, ...opts))

  // Open the track
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  // Get canvas snapshot
  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 25000)
