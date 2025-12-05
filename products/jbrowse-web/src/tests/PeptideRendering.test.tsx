import userEvent from '@testing-library/user-event'

import { createView, hts, setupTest, waitForCanvasSnapshot } from './util'

setupTest()

const delay = { timeout: 20000 }
const opts = [{}, delay] as const

test('renders peptide letters on CDS features', async () => {
  const user = userEvent.setup()
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  await view.navToLocString('ctgA:3,292..3,323')

  // Enable Color by CDS
  await user.click(await findByTestId('view_menu_icon', ...opts))
  await user.click(await findByText(/Color by CDS/, ...opts))

  // Open the track
  await user.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  // Get canvas snapshot
  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 25000)
