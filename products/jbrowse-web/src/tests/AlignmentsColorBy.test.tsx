import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  hts,
  pv,
} from './util'

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
  await user.click(await screen.findByText('Color scheme'))
  await user.click(await screen.findByText('Color by tag...'))
  await user.type(
    await screen.findByPlaceholderText('Enter tag name', ...opts),
    'HP',
  )
  await user.click(await screen.findByText('Submit'))
  await screen.findAllByTestId('pileup-tag-HP', ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv('39805..40176-0'), ...opts))
}, 50000)

test('color by stranded rna-seq', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(10, 0)
  await user.click(
    await screen.findByTestId(hts('paired_end_stranded_rnaseq'), ...opts),
  )
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Color scheme'))
  await user.click(await screen.findByText('First-of-pair strand'))
  await screen.findAllByTestId('pileup-stranded', ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv('1..8000-0'), ...opts))
}, 50000)
