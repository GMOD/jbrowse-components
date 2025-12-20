import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('renders peptide letters on CDS features', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  await view.navToLocString('ctgA:3,292..3,323')

  // Enable Color by CDS
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText(/Color by CDS/, ...opts))

  // Open the track
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  // Get canvas snapshot
  const canvases = await findAllByTestId(/prerendered_canvas/, ...opts)
  expectCanvasMatch(canvases[0]!)
}, 25000)
