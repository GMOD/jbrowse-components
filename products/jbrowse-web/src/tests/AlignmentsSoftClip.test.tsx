import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  pc,
  hts,
} from './util'

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
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show soft clipping'))
  const f0 = within(await screen.findByTestId('Blockset-pileup'))
  // slightly higher threshold for fonts
  expectCanvasMatch(
    await f0.findByTestId(pc('softclipped_{volvox}ctgA:2849..2864-0'), ...opts),
    0.05,
  )
}, 60000)
