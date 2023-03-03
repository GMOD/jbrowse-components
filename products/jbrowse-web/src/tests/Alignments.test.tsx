import { fireEvent, within } from '@testing-library/react'

// locals
import {
  setup,
  expectCanvasMatch,
  createView,
  hts,
  doBeforeEach,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('opens an alignments track', async () => {
  const { view, findByTestId, findByText, findAllByTestId } = createView()
  await findByText('Help')
  view.setNewView(5, 100)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  const f1 = within(await findByTestId('Blockset-pileup', ...opts))
  const f2 = within(await findByTestId('Blockset-snpcoverage', ...opts))
  expectCanvasMatch(await f1.findByTestId(pv('1..4000-0'), ...opts))
  expectCanvasMatch(await f2.findByTestId(pv('1..4000-0'), ...opts))

  const track = await findAllByTestId('pileup_overlay_canvas')
  fireEvent.mouseMove(track[0], { clientX: 200, clientY: 20 })
  fireEvent.click(track[0], { clientX: 200, clientY: 40 })
  fireEvent.mouseDown(track[0], { clientX: 200, clientY: 20 })
  fireEvent.mouseMove(track[0], { clientX: 300, clientY: 20 })
  fireEvent.mouseUp(track[0], { clientX: 300, clientY: 20 })
  fireEvent.mouseMove(track[0], { clientX: -100, clientY: -100 })

  // this is to confirm a alignment detail widget opened
  await findByTestId('alignment-side-drawer', ...opts)
}, 20000)

test('test that bam with small max height displays message', async () => {
  const { findByTestId, findAllByText } = createView()
  fireEvent.click(
    await findByTestId(hts('volvox_bam_small_max_height'), ...opts),
  )

  await findAllByText('Max height reached', ...opts)
}, 30000)

test('test snpcoverage doesnt count snpcoverage', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.03932, 67884.16536402702)
  fireEvent.click(await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts))
  const f1 = within(await findByTestId('Blockset-snpcoverage', ...opts))
  expectCanvasMatch(await f1.findByTestId(pv('2657..2688-0'), ...opts))
  expectCanvasMatch(await f1.findByTestId(pv('2689..2720-0'), ...opts))
}, 30000)
