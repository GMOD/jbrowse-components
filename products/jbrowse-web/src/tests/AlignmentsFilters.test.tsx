import { fireEvent, screen } from '@testing-library/react'

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

// only the tracks this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_cram', 'volvox_bam'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

async function testFilterTrack(trackId: string, tag: string, value: string) {
  fireEvent.click(await screen.findByTestId(hts(trackId), ...opts))
  fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
  // TWO HOPS since the read categories moved into this group: `filterMenuItems`
  // keeps the lone dialog opener as a top-level row, and the alignments display
  // now passes `readCategories: true`, so the group has rows and becomes a
  // submenu with the dialog behind `Edit filters...`.
  fireEvent.click(await screen.findByText('Filter by...'))
  fireEvent.click(await screen.findByText('Edit filters...'))
  fireEvent.change(await screen.findByLabelText('Tag name', ...opts), {
    target: { value: tag },
  })
  fireEvent.change(
    await screen.findByPlaceholderText('Enter value or * for any'),
    { target: { value } },
  )
  fireEvent.click(await screen.findByText('Submit'))
  const display = await findDisplayPainted('pileup-display', delay)
  expectCanvasMatch(findCanvasIn(display))
}

test('filter by HP tag cram', async () => {
  const { view } = await createView(config)
  view.setNewView(0.8, 49437)
  await testFilterTrack('volvox_cram', 'HP', '1')
}, 50000)

test('filter by HP tag bam', async () => {
  const { view } = await createView(config)
  view.setNewView(0.8, 49437)
  await testFilterTrack('volvox_bam', 'HP', '1')
}, 50000)
