import { fireEvent } from '@testing-library/react'
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

const timeout = 60000
const delay = { timeout }
const opts = [{}, delay]

test(
  'opens an alignments track and clicks feature',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId } = await createView()
    view.setNewView(5, 100)
    await user.click(
      await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
    )

    const display = await findByTestId('pileup-display-done', ...opts)
    const canvas = findCanvasIn(display)
    expectCanvasMatch(canvas)

    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
    fireEvent.click(canvas, { clientX: 200, clientY: 80 })

    // this is to confirm a alignment detail widget opened
    await findByTestId('alignment-side-drawer', ...opts)
  },
  timeout + 10_000,
)

// maxHeight rendering may work differently in new display
xtest(
  'test that bam with small max height displays message',
  async () => {
    const user = userEvent.setup()
    const { findByTestId, findAllByText } = await createView()
    await user.click(
      await findByTestId(hts('volvox_bam_small_max_height'), ...opts),
    )

    await findAllByText('Max height reached', ...opts)
  },
  timeout + 10_000,
)

test(
  'test snpcoverage doesnt count snpcoverage',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId } = await createView()
    view.setNewView(0.03932, 67884.16536402702)
    await user.click(
      await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts),
    )
    const display = await findByTestId('pileup-display-done', ...opts)
    expectCanvasMatch(findCanvasIn(display))
  },
  timeout + 10_000,
)
