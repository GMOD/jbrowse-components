import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_cram_alignments_ctga'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('selects a sort, sort by base pair', async () => {
  const user = userEvent.setup()
  const { view } = await createView(config)
  view.setNewView(0.043688891869634636, 301762)

  // load track
  await user.click(
    await screen.findByTestId(hts('volvox_cram_alignments_ctga'), ...opts),
  )
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))

  await user.click(await screen.findByText('Sort by...'))
  await user.click(await screen.findByText('Base pair'))
  const display1 = await findDisplayPainted('pileup-display', delay)
  expectCanvasMatch(findCanvasIn(display1), 0.1)
  await new Promise(resolve => setTimeout(resolve, 1000))
  await user.click(await screen.findByTestId('zoom_out'))
  const display2 = await findDisplayPainted('pileup-display', delay)
  expectCanvasMatch(findCanvasIn(display2), 0.1)
}, 35000)
