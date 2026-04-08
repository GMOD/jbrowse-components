import { fireEvent, waitFor } from '@testing-library/react'

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

const delay = { timeout: 20000 }
const o = [{}, delay]

test('test stats estimation pileup, zoom in to see', async () => {
  const { view, findAllByText, findByTestId } = await createView()
  view.setNewView(30, 183)
  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))
  await findAllByText(/Requested too much data|Force load/, ...o)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  const display = await findByTestId('pileup-display-done', ...o)
  findCanvasIn(display)
}, 30000)

test('test stats estimation pileup, force load to see', async () => {
  const { view, findAllByText, findByTestId } = await createView()
  view.setNewView(25.07852564102564, 283)

  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))

  await findAllByText(/Requested too much data/, ...o)
  const buttons = await findAllByText(/Force load/, ...o)
  fireEvent.click(buttons[0]!)

  // After force load, wait for pileup to render
  const display = await findByTestId('pileup-display-done', ...o)
  expectCanvasMatch(findCanvasIn(display))
}, 60000)

// skip: canvas rendering for LinearVariantDisplay produces empty output
// in jsdom (node-canvas mock doesn't cover the GPU canvas2d fallback path).
// Move to browser-tests.
test.skip('test stats estimation on vcf track, zoom in to see', async () => {
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(34, 5)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  await findAllByText(/Zoom in to see features/, ...o)

  // mock RAF+performance.now for spring animation in jsdom
  const origRAF = window.requestAnimationFrame
  const origPerfNow = performance.now.bind(performance)
  let fakeTime = origPerfNow()
  performance.now = () => fakeTime
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    fakeTime += 16
    cb(fakeTime)
    return 0
  }

  await waitFor(() => {
    expect(view.coarseBpPerPx).toBeGreaterThan(0)
  }, delay)

  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)

  window.requestAnimationFrame = origRAF
  performance.now = origPerfNow

  const displays = await findAllByTestId(/^display-.*-done$/, ...o)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 30000)

test.skip('test stats estimation on vcf track, force load to see', async () => {
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(34, 5)
  await findAllByText('ctgA', ...o)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  fireEvent.click((await findAllByText(/Force load/, ...o))[0]!)
  const displays = await findAllByTestId(/^display-.*-done$/, ...o)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 30000)
