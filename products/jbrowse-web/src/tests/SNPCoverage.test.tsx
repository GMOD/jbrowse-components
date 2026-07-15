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
  'snpcoverage interbase counts rendering',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId } = await createView()
    view.setNewView(5, 2662)
    await user.click(
      await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
    )

    const display = await findByTestId('pileup-display-done', ...opts)
    expectCanvasMatch(findCanvasIn(display))
  },
  timeout + 10_000,
)
