import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectBlocksetCanvasMatch,
  pv,
  selectTrackMenuOption,
  setupTest,
} from './util'

setupTest()

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

test('color by tag', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await selectTrackMenuOption(user, 'volvox_cram', [
    'Color by...',
    'Color by tag...',
  ])
  await user.type(
    await screen.findByPlaceholderText('Enter tag name', ...opts),
    'HP',
  )
  await user.click(await screen.findByText('Submit'))
  await screen.findAllByTestId('pileup-overlay-tag-HP', ...opts)
  await expectBlocksetCanvasMatch('pileup', pv('39805..40176-0'), 30000)
}, 50000)

test('color by stranded rna-seq', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(10, 0)
  await selectTrackMenuOption(user, 'paired_end_stranded_rnaseq', [
    'Color by...',
    'First-of-pair strand',
  ])
  await screen.findAllByTestId('pileup-overlay-stranded', ...opts)

  // note on test flakiness: this is the taller of two blocks, (the first
  // having it 1-8000-0), but if the first block is rendered first, it has a
  // shorter height, but if it is rendered second, it takes the height of the
  // tallest black since it is layout.getTotalHeight as the canvas height
  await expectBlocksetCanvasMatch('pileup', pv('8001..16000-0'), 30000)
}, 50000)
