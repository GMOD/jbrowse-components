import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectBlocksetCanvasMatch,
  openTrackMenu,
  pc,
  setupTest,
} from './util'

setupTest()

test('opens the track menu and enables soft clipping', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.02, 142956)

  await openTrackMenu(user, 'volvox-long-reads-sv-bam')
  await user.click(await screen.findByText('Show soft clipping'))
  // slightly higher threshold for fonts
  await expectBlocksetCanvasMatch(
    'pileup',
    pc('softclipped_{volvox}ctgA:2849..2864-0'),
    30000,
    0.05,
  )
}, 60000)
