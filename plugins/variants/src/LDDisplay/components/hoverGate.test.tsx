import { act, fireEvent, render, waitFor } from '@testing-library/react'

import { createTestEnvironment } from '../testEnv.ts'
import LDDisplayComponent from './LDDisplayComponent.tsx'

import type { LDDataResult } from '../../RenderLDDataRPC/types.ts'

// A worker result for n evenly spaced SNPs, the shape `overlayCoords.test.ts`
// builds — uniform columns in the un-rotated frame plus the boundaries array
// the hit test walks.
function ldData(n: number, widthBp: number, originBp: number): LDDataResult {
  const uniformW = widthBp / (n * Math.SQRT2)
  return {
    snps: Array.from({ length: n }, (_, i) => ({
      id: `rs${i}`,
      refName: 'ctgA',
      start: i * 1000,
      end: i * 1000 + 1,
    })),
    ldValues: Float32Array.from(
      { length: (n * (n - 1)) / 2 },
      (_, i) => i / 10,
    ),
    boundaries: Float32Array.from({ length: n + 1 }, (_, i) => i * uniformW),
    numCells: (n * (n - 1)) / 2,
    band: 1_000_000,
    uniformW,
    originBp,
    genomicMode: false,
    metric: 'r2',
    hasDprime: true,
    method: 'phased',
    signedLD: false,
  }
}

// A mounted display with a real matrix in it and its fetch settled. The
// harness's bare RPC stub never settles, so the display would otherwise sit at
// `isLoading` forever — and a test that cannot reach `ready` cannot tell the
// two spellings of the hover gate apart at all.
async function loadedDisplay() {
  const env = createTestEnvironment()
  const { display, view } = env.createDisplay()
  view.zoomTo(10)
  const widthBp = view.dynamicBlocks.totalWidthPxWithoutBorders * view.bpPerPx
  env.mockRpcCall.mockImplementation(
    (_sessionId: string, method: string, args: { originBp: number }) =>
      method === 'RenderLDData'
        ? Promise.resolve(ldData(4, widthBp, args.originBp))
        : new Promise(() => {}),
  )

  render(<LDDisplayComponent model={display} />)
  await waitFor(() => {
    expect(display.rpcData).toBeDefined()
  })
  expect(display.displayPhase).toBe('ready')

  // the centre of the cell pairing rs2 with rs1, in the canvas's own frame —
  // which is also the client frame here, jsdom measuring every box at the
  // origin
  const { boundaries } = display.rpcData!
  const centre = (k: number) => (boundaries[k]! + boundaries[k + 1]!) / 2
  const cell = display.cellToScreen(centre(1), centre(2))
  expect(display.hitTest(cell.x, cell.y)?.snp1.id).toBe('rs2')

  return { display, cell }
}

// The measurement is rAF-coalesced, so the move has to be given a frame before
// anything reads it.
async function hoverAt({ x, y }: { x: number; y: number }) {
  await act(async () => {
    fireEvent.mouseMove(document.querySelector('[data-testid="ld-display"]')!, {
      clientX: x,
      clientY: y,
    })
    await new Promise(resolve => setTimeout(resolve, 60))
  })
}

const tooltipShowing = () => document.body.textContent.includes('rs2')

// Every test here mounts a real display through `loadedDisplay()` — RPC,
// canvas measurement, a `hitTest` — and at least one real 60ms hover wait, so
// each gets the same longer timeout `JBrowseLinearGenomeView.test.tsx` gives a
// view mount for the same reason: real async work across an RPC + rAF
// boundary, not a hung test.

test('a hover over a loaded cell names its pair of SNPs', async () => {
  const { cell } = await loadedDisplay()

  await hoverAt(cell)

  expect(tooltipShowing()).toBe(true)
}, 30000)

// `isLoadingOrCanceled`, never a bare `isLoading` — the same rule arc's
// `shared/displayPhase.test.ts` pins for its phase.
//
// `cancelFetchByUser` drops the stop token synchronously, so `isLoading` goes
// false the instant the user clicks Cancel while `fetchCanceled` stays true and
// nothing restarts the fetch. Gated on `isLoading` alone the hover therefore
// reads as a settled display: the "Loading canceled / Retry" overlay is up
// saying there is nothing here, and a tooltip floats over the cells underneath
// it naming SNPs the overlay says are not there.
test('a standing cancel takes the hover with it', async () => {
  const { display, cell } = await loadedDisplay()
  await hoverAt(cell)
  expect(tooltipShowing()).toBe(true)

  await act(async () => {
    display.cancelFetchByUser()
    await new Promise(resolve => setTimeout(resolve, 60))
  })

  // the state the overlay is describing: stopped, not loading
  expect(display.isLoading).toBe(false)
  expect(display.fetchCanceled).toBe(true)
  expect(tooltipShowing()).toBe(false)

  // and the overlay really is the thing the tooltip would have been
  // floating over. Awaited, because the scrim holds a 250ms anti-flash
  // timer before it paints anything (DisplayStatusChromeBase).
  await waitFor(() => {
    expect(document.body.textContent).toContain('Loading canceled')
  })
  expect(tooltipShowing()).toBe(false)
}, 30000)

// ...and the gate holds for a pointer that arrives while the cancel is already
// standing, which is the same read on a fresh render rather than on a
// re-render.
test('a hover arriving under a standing cancel finds nothing', async () => {
  const { display, cell } = await loadedDisplay()
  display.cancelFetchByUser()

  await hoverAt(cell)

  expect(tooltipShowing()).toBe(false)
}, 30000)

// The cancel is durable, not permanent: retrying starts a fetch, and once that
// lands the cells answer the pointer again.
test('the hover comes back once the retry lands', async () => {
  const { display, cell } = await loadedDisplay()
  display.cancelFetchByUser()
  await hoverAt(cell)
  expect(tooltipShowing()).toBe(false)

  await act(async () => {
    display.reload()
  })
  await waitFor(() => {
    expect(display.isLoadingOrCanceled).toBe(false)
  })

  await hoverAt(cell)

  expect(tooltipShowing()).toBe(true)
}, 60000) // the only test here that drives a second round trip, so it flushes the most tooltip repositions
