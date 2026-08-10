import { fireEvent } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the tracks this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks([
  'volvox_alignments_pileup_coverage',
  'volvox-long-reads-sv-cram',
])

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
    const { view, findByTestId } = await createView(config)
    view.setNewView(5, 100)
    await user.click(
      await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
    )

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    expectCanvasMatch(canvas)

    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 80 })
    fireEvent.click(canvas, { clientX: 200, clientY: 80 })

    // this is to confirm a alignment detail widget opened
    await findByTestId('alignment-side-drawer', ...opts)
  },
  timeout + 10_000,
)

test(
  'test snpcoverage doesnt count snpcoverage',
  async () => {
    const user = userEvent.setup()
    const { view, findByTestId } = await createView(config)
    view.setNewView(0.03932, 67884.16536402702)
    await user.click(
      await findByTestId(hts('volvox-long-reads-sv-cram'), ...opts),
    )
    const display = await findDisplayPainted('pileup-display', delay)
    expectCanvasMatch(findCanvasIn(display))
  },
  timeout + 10_000,
)
