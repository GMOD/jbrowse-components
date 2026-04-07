import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

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

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('opens the track menu and enables soft clipping', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.02, 142956)

  await user.click(
    await screen.findByTestId(hts('volvox-long-reads-sv-bam'), ...opts),
  )
  // wait for initial render before toggling soft clipping
  await screen.findByTestId('pileup-display-done', ...opts)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show...'))
  await user.click(await screen.findByText('Show soft clipping'))
  // slightly higher threshold for fonts
  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display), 0.05)
}, 60000)
