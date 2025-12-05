import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, openTrackMenu, setupTest } from './util'

setupTest()

test('check pin track', async () => {
  const user = userEvent.setup()
  await createView()
  await openTrackMenu(user, 'volvox_cram')
  await user.click(await screen.findByText('Pin track'))
}, 50000)
