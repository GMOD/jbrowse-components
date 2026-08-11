import { fireEvent } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findAnyDisplayPainted,
  findCanvasIn,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['bedtabix_genes'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('renders peptide letters on CDS features', async () => {
  const { view, findByTestId, findByText } = await createView(config)
  await view.navToLocString('ctgA:3,292..3,323')

  // Frame coloring is opt-in; the amino acids on top of it are not
  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText(/Color CDS by reading frame/, ...opts))

  // Open the track
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  // Get canvas snapshot
  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 25000)

test('renders peptide letters without color by CDS', async () => {
  const { view, findByTestId } = await createView(config)
  await view.navToLocString('ctgA:3,292..3,323')

  // no menu interaction: showAminoAcids is on by default, so the codons are
  // shaded and lettered over the track's own feature color
  fireEvent.click(await findByTestId(hts('bedtabix_genes'), ...opts))

  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 25000)
