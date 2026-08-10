import { fireEvent, screen } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayById,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['gff3tabix_genes'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('toggle subfeature labels and verify eden.1 label appears', async () => {
  const { view } = await createView(config)

  await view.navToLocString('ctgA:907..15,319')
  fireEvent.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await screen.findByText('Show...', ...opts))
  fireEvent.click(await screen.findByText('Subfeature labels', ...opts))
  fireEvent.click(await screen.findByText('Below', ...opts))

  await screen.findByText('EDEN.1', ...opts)

  const display = await findDisplayById('gff3tabix_genes-LinearBasicDisplay')
  expectCanvasMatch(findCanvasIn(display))
}, 50000)
