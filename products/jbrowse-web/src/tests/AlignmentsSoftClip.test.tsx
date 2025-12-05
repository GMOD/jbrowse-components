import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectCanvasMatch,
  openTrackMenu,
  pc,
  setupTest,
} from './util'

setupTest()

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

test('opens the track menu and enables soft clipping', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.02, 142956)

  await openTrackMenu(user, 'volvox-long-reads-sv-bam')
  await user.click(await screen.findByText('Show soft clipping'))
  const f0 = within(await screen.findByTestId('Blockset-pileup'))
  // slightly higher threshold for fonts
  expectCanvasMatch(
    await f0.findByTestId(pc('softclipped_{volvox}ctgA:2849..2864-0'), ...opts),
    0.05,
  )
}, 60000)
