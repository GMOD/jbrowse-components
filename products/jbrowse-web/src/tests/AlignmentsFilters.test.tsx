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
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

async function testFilterTrack(trackId: string, tag: string, value: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByTestId(hts(trackId), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Filter by...'))
  await user.type(await screen.findByLabelText('Tag name', ...opts), tag)
  await user.type(
    await screen.findByPlaceholderText('Enter value or * for any'),
    value,
  )
  await user.click(await screen.findByText('Submit'))
  const display = await findDisplayPainted('pileup-display', delay)
  expectCanvasMatch(findCanvasIn(display))
}

test('filter by HP tag cram', async () => {
  const { view } = await createView()
  view.setNewView(0.8, 49437)
  await testFilterTrack('volvox_cram', 'HP', '1')
}, 50000)

test('filter by HP tag bam', async () => {
  const { view } = await createView()
  view.setNewView(0.8, 49437)
  await testFilterTrack('volvox_bam', 'HP', '1')
}, 50000)
