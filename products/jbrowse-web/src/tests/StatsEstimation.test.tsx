import { fireEvent, waitFor } from '@testing-library/react'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  hts,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const o = [{}, delay]

test('test stats estimation pileup, zoom in to see', async () => {
  const { view, findAllByText, findByTestId } = await createView()
  view.setNewView(30, 183)
  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))
  await findAllByText(/Requested too much data/, ...o)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  expectCanvasMatch(await findByTestId(pv('1..12000-0'), ...o))
}, 30000)

test('test stats estimation pileup, force load to see', async () => {
  const { view, findAllByText, findByTestId } = await createView()
  view.setNewView(25.07852564102564, 283)

  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))

  await findAllByText(/Requested too much data/, ...o)
  const buttons = await findAllByText(/Force load/, ...o)
  fireEvent.click(buttons[0]!)

  expectCanvasMatch(await findByTestId(pv('1..20063-0'), ...o))
}, 30000)

test('test stats estimation on vcf track, zoom in to see', async () => {
  const { view, findAllByText, findAllByTestId, findByTestId } =
    await createView()
  view.setNewView(34, 5)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  await findAllByText(/Zoom in to see features/, ...o)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  // found it helps avoid flaky test to check that it is zoomed in before
  // checking snapshot (even though it seems like it is unneeded) #2673
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  await findAllByTestId('box-test-vcf-606969', ...o)
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const { view, findAllByText, findAllByTestId, findByTestId } =
    await createView()
  view.setNewView(34, 5)
  await findAllByText('ctgA', ...o)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  fireEvent.click((await findAllByText(/Force load/, ...o))[0]!)
  await findAllByTestId('box-test-vcf-605224', ...o)
}, 30000)
