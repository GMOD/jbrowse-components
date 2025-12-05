import userEvent from '@testing-library/user-event'

import { createView, selectTrackMenuOption, setupTest } from './util'

setupTest()

test('check pin track', async () => {
  const user = userEvent.setup()
  await createView()
  await selectTrackMenuOption(user, 'volvox_cram', ['Pin track'])
}, 50000)
