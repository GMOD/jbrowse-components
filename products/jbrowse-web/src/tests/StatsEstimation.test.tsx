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

// The byte gate has no span floor, so zooming past 20kb no longer waves an
// over-budget pileup through. That used to be the way out here, and it was never
// real: read cost scales with depth, and a BAI quotes whole blocks, so the same
// bytes come down however far you zoom. The banner stops offering zoom once two
// measurements say it does not move the number — otherwise it prints advice that
// cannot work. The VCF case below still covers "zoom in to see", where zooming
// really does shrink the fetch.
test('test stats estimation pileup, zooming past the floor keeps the banner', async () => {
  const { view, findAllByText, findByTestId, queryAllByText } =
    await createView()
  view.setNewView(30, 183)
  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))
  await findAllByText(/Requested too much data/, ...o)
  const before = view.bpPerPx
  fireEvent.click(await findByTestId('zoom_in'))
  await waitFor(() => {
    expect(view.bpPerPx).toBe(before / 2)
  }, delay)
  expect(view.visibleBp).toBeLessThan(20_000)

  // still gated, and now offering only the way out that actually works
  await findAllByText(/Requested too much data/, ...o)
  await findAllByText(/Force load/, ...o)
  expect(queryAllByText(/Zoom in to see features/)).toHaveLength(0)
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

test('test stats estimation on vcf track, zoom in to see', async () => {
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

  const displays = await findAllByTestId(/-display-done$/, ...o)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const { view, findAllByText, findByTestId, findAllByTestId } =
    await createView()
  view.setNewView(34, 5)
  await findAllByText('ctgA', ...o)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  fireEvent.click((await findAllByText(/Force load/, ...o))[0]!)
  const displays = await findAllByTestId(/-display-done$/, ...o)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 30000)
