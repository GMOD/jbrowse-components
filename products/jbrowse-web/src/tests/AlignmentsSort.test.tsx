import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectCanvasMatch,
  openTrackMenu,
  pv,
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
  await openTrackMenu(user, 'volvox_cram_alignments_ctga')
  await user.click(await screen.findByText('Sort by...'))
  await user.click(await screen.findByText('Base pair'))
  await screen.findAllByTestId('pileup-overlay-Base pair-normal', ...opts)
  const f1 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f1.findByTestId(pv('13196..13230-0'), ...opts))
  await sleep(1000)
  await user.click(await screen.findByTestId('zoom_out'))
  await screen.findAllByTestId('pileup-overlay-Base pair-normal', ...opts)
  const f2 = within(await screen.findByTestId('Blockset-pileup'))
  expectCanvasMatch(await f2.findByTestId(pv('13161..13230-0'), ...opts))
}, 35000)
