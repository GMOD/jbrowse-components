import { fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectAlignmentCanvasMatch,
  hts,
  pv,
  setupTest,
} from './util'

setupTest()

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('opens an alignments track and clicks feature', async () => {
  const user = userEvent.setup()
  const { view, findByTestId, findAllByTestId } = await createView()
  view.setNewView(5, 100)
  await user.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  await expectAlignmentCanvasMatch([
    { blockset: 'pileup', canvasId: pv('1..4000-0') },
    { blockset: 'snpcoverage', canvasId: pv('1..4000-0') },
  ], 60000)

  const track = await findAllByTestId('pileup-overlay-normal')
  fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.click(track[0]!, { clientX: 200, clientY: 40 })
  fireEvent.mouseDown(track[0]!, { clientX: 200, clientY: 20 })
  fireEvent.mouseMove(track[0]!, { clientX: 300, clientY: 20 })
  fireEvent.mouseUp(track[0]!, { clientX: 300, clientY: 20 })
  fireEvent.mouseMove(track[0]!, { clientX: -100, clientY: -100 })

  // this is to confirm a alignment detail widget opened
  await findByTestId('alignment-side-drawer', ...opts)
}, 60000)

test('test that bam with small max height displays message', async () => {
  const user = userEvent.setup()
  const { findByTestId, findAllByText } = await createView()
  await user.click(
    await findByTestId(hts('volvox_bam_small_max_height'), ...opts),
  )

  await findAllByText('Max height reached', ...opts)
}, 60000)

test('test snpcoverage doesnt count snpcoverage', async () => {
  const user = userEvent.setup()
  const { view, findByTestId } = await createView()
  view.setNewView(0.03932, 67884.16536402702)
  await user.click(
    await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts),
  )
  await expectAlignmentCanvasMatch([
    { blockset: 'snpcoverage', canvasId: pv('2657..2688-0') },
    { blockset: 'snpcoverage', canvasId: pv('2689..2720-0') },
  ], 60000)
}, 60000)
