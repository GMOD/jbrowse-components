import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('renders peptide letters on CDS features', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = await createView()
  await view.navToLocString('ctgA:3,292..3,323')

  // Frame coloring is opt-in; the amino acids on top of it are not
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText(/Color CDS by reading frame/, ...opts))

  // Open the track
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  // Get canvas snapshot
  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 25000)

test('renders peptide letters without color by CDS', async () => {
  const { view, findByTestId, findAllByTestId } = await createView()
  await view.navToLocString('ctgA:3,292..3,323')

  // no menu interaction: showAminoAcids is on by default, so the codons are
  // shaded and lettered over the track's own feature color
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 25000)
