import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
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

    const f = within(await findByTestId('Blockset-snpcoverage', ...opts))
    expectCanvasMatch(await f.findByTestId(/prerendered_canvas/, ...opts))
  },
  timeout + 10_000,
)
