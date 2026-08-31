import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findAnyDisplayPainted,
  findCanvasIn,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

// the two tracks this file gates - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_cram_pileup', 'variant_colors'])

const delay = { timeout: 20000 }
const o = [{}, delay]

// The byte gate has no span floor, so zooming past 20kb no longer waves an
// over-budget pileup through — the point of this test, and the reason the CRAM
// stays gated below. What the banner offers as a way out is now *measured*:
// `zoomCanReleaseGate` drops "Zoom in to see features" once a measurement at a
// materially smaller span comes back materially unchanged.
//
// Which is why the advice survives the first zoom and not the second. This CRAM
// really is flat — 125,172 bytes at every span from 24kb down, because a CRAI
// quotes whole containers — but at the moment of the first zoom the only
// measurement in hand was taken at the span the user just left, and one point is
// not evidence. The second measurement is, and it costs one settled fetch cycle
// to get. That is the honest price of evidence over the threshold this replaced,
// which guessed the same answer from a 20kb floor and guessed wrong for every
// display that kept it.
test('test stats estimation pileup, zooming past the floor keeps the banner', async () => {
  const { view, findAllByText, findByTestId, queryAllByText } =
    await createView(config)
  view.setNewView(30, 183)
  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))
  await findAllByText(/Requested too much data/, ...o)

  async function zoomIn() {
    const before = view.bpPerPx
    fireEvent.click(await findByTestId('zoom_in'))
    await waitFor(() => {
      expect(view.bpPerPx).toBe(before / 2)
    }, delay)
  }

  await zoomIn()
  expect(view.visibleBp).toBeLessThan(20_000)
  // still gated below the floor, which is the whole point
  await findAllByText(/Requested too much data/, ...o)
  await findAllByText(/Force load/, ...o)

  // ...and once a second measurement lands at half the span with the same
  // bytes, the banner stops offering a way out that cannot work. This is also
  // the end-to-end pin that a blocked display keeps re-measuring at all: nothing
  // else re-runs while the banner holds, so the advice could never change.
  await zoomIn()
  await waitFor(() => {
    expect(queryAllByText(/Zoom in to see features/)).toHaveLength(0)
  }, delay)
  await findAllByText(/Force load/, ...o)
}, 60000)

test('test stats estimation pileup, force load to see', async () => {
  const { view, findAllByText, findByTestId } = await createView(config)
  view.setNewView(25.07852564102564, 283)

  fireEvent.click(await findByTestId(hts('volvox_cram_pileup'), ...o))

  await findAllByText(/Requested too much data/, ...o)
  const buttons = await findAllByText(/Force load/, ...o)
  fireEvent.click(buttons[0]!)

  // After force load, wait for pileup to render
  const display = await findDisplayPainted('pileup-display', delay)
  expectCanvasMatch(findCanvasIn(display))
}, 60000)

test('test stats estimation on vcf track, zoom in to see', async () => {
  const { view, findAllByText, findByTestId } = await createView(config)
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

  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 30000)

test('test stats estimation on vcf track, force load to see', async () => {
  const { view, findAllByText, findByTestId } = await createView(config)
  view.setNewView(34, 5)
  await findAllByText('ctgA', ...o)
  fireEvent.click(await findByTestId(hts('variant_colors'), ...o))
  fireEvent.click((await findAllByText(/Force load/, ...o))[0]!)
  const display = await findAnyDisplayPainted(delay)
  expectCanvasMatch(findCanvasIn(display))
}, 30000)
