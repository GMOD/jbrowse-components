import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, test } from 'vitest'

import { createView, doBeforeEach, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('check pin track', async () => {
  const user = userEvent.setup()
  await createView()
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Pin track'))
}, 50000)
