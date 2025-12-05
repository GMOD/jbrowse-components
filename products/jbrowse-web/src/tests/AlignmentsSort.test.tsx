import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectBlocksetCanvasMatch,
  pv,
  selectTrackMenuOption,
  setupTest,
  sleep,
} from './util'

setupTest()

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

test('selects a sort, sort by base pair', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.043688891869634636, 301762)

  // load track
  await selectTrackMenuOption(user, 'volvox_cram_alignments_ctga', [
    'Sort by...',
    'Base pair',
  ])
  await screen.findAllByTestId('pileup-overlay-Base pair-normal', ...opts)
  await expectBlocksetCanvasMatch('pileup', pv('13196..13230-0'), 30000)
  await sleep(1000)
  await user.click(await screen.findByTestId('zoom_out'))
  await screen.findAllByTestId('pileup-overlay-Base pair-normal', ...opts)
  await expectBlocksetCanvasMatch('pileup', pv('13161..13230-0'), 30000)
}, 35000)
