import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, hts, setupTest, waitForCanvasSnapshot } from './util'

setupTest()

const delay = { timeout: 20000 }
const o = [{}, delay] as const

test('test stats estimation pileup, zoom in to see', async () => {
  const user = userEvent.setup()
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(30, 183)
  await user.click(await findByTestId(hts('volvox_cram_pileup'), ...o))
  await findAllByText(/Requested too much data/, ...o)
  const before = view.bpPerPx
  await user.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 30000)

xtest('test stats estimation pileup, force load to see', async () => {
  const user = userEvent.setup()
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(25.07852564102564, 283)

  await user.click(await findByTestId(hts('volvox_cram_pileup'), ...o))

  await findAllByText(/Requested too much data/, ...o)
  const buttons = await findAllByText(/Force load/, ...o)
  await user.click(buttons[0]!)

  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 30000)

xtest('test stats estimation on vcf track, zoom in to see', async () => {
  const user = userEvent.setup()
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(34, 5)
  await user.click(await findByTestId(hts('variant_colors'), ...o))
  await findAllByText(/Zoom in to see features/, ...o)
  const before = view.bpPerPx
  await user.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 30000)

xtest('test stats estimation on vcf track, force load to see', async () => {
  const user = userEvent.setup()
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(34, 5)
  await findAllByText('ctgA', ...o)
  await user.click(await findByTestId(hts('variant_colors'), ...o))
  await user.click((await findAllByText(/Force load/, ...o))[0]!)
  await waitForCanvasSnapshot(findAllByTestId, 20000)
}, 30000)
