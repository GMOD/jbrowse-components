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

test('color by tag', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Color by...'))
  await user.click(await screen.findByText('Color by tag...'))
  await user.type(
    await screen.findByLabelText('Tag name', ...opts),
    'HP',
  )
  await user.click(await screen.findByText('Submit'))
  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display))
}, 50000)

test('color by stranded rna-seq', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(10, 0)
  await user.click(
    await screen.findByTestId(hts('paired_end_stranded_rnaseq'), ...opts),
  )
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Color by...'))
  await user.click(await screen.findByText('First of pair strand'))
  const display = await screen.findByTestId('pileup-display-done', ...opts)
  expectCanvasMatch(findCanvasIn(display), 0.1)
}, 50000)
