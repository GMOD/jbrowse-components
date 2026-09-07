import { waitFor } from '@testing-library/react'

import configSnapshot from '../../test_data/grape_peach_synteny/config.json' with { type: 'json' }
import {
  grapePeachGetFile,
  utilizeFetchMockForTest,
} from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

// Dotplot and synteny both hang one canvas above several displays, so hiding a
// track cannot unmount anything — the container has to repaint, or the departed
// track's pixels stay up. Both keep the same shape (resolved render state, keys
// hashed per display, a repaint that always covers the whole canvas); these are
// the tests that hold them to it. What each frame names its per-display list is
// where they differ: synteny hands the backend one `perTrack` map, dotplot one
// canvas-wide block per display keyed by the same hash. See
// agent-docs/reference/SHARED_CANVAS_VIEWS.md §"The empty frame is
// load-bearing".

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

utilizeFetchMockForTest(grapePeachGetFile)

// the slice of synteny's render state these tests assert on
interface SyntenyState {
  perTrack: Map<number, unknown>
}

function fakeCalls<Frame>() {
  return {
    uploaded: [] as number[],
    deleted: [] as number[],
    rendered: [] as Frame[],
  }
}

function fakeSyntenyBackend() {
  const calls = fakeCalls<SyntenyState>()
  return {
    calls,
    backend: {
      resize() {},
      upload(key: number) {
        calls.uploaded.push(key)
      },
      release(key: number) {
        calls.deleted.push(key)
      },
      render(state: SyntenyState) {
        calls.rendered.push(state)
      },
      pick() {
        return undefined
      },
      dispose() {},
    },
  }
}

// Dotplot draws through the per-region contract, so the per-display list a
// frame carries is its block list — one canvas-wide block per display, keyed
// by the same hash the upload used.
function fakeDotplotBackend() {
  const calls = fakeCalls<number[]>()
  return {
    calls,
    backend: {
      upload(key: number) {
        calls.uploaded.push(key)
      },
      release(key: number) {
        calls.deleted.push(key)
      },
      renderBlocks(blocks: { displayedRegionIndex: number }[]) {
        calls.rendered.push(blocks.map(b => b.displayedRegionIndex))
        return blocks.length > 0
      },
      dispose() {},
    },
  }
}

async function session() {
  const { rootModel } = await getPluginManager(configSnapshot)
  rootModel.setDefaultSession()
  return rootModel.session!
}

async function loadedDotplot(tracks: string[]) {
  const view = await (
    await session()
  ).launchView('DotplotView', {
    views: [{ assembly: 'peach' }, { assembly: 'grape' }],
    tracks,
  })
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
  const { calls, backend } = fakeDotplotBackend()
  view.startRenderingBackend(backend)
  // settle before measuring: a late geometry commit would otherwise land in the
  // upload counts these tests attribute to the hide
  await waitFor(
    () => {
      expect(view.settled).toBe(true)
      expect(calls.rendered.at(-1)?.length).toBe(tracks.length)
    },
    { timeout: 30000 },
  )
  return { view, calls }
}

async function loadedSynteny(tracks: string[]) {
  const view = await (
    await session()
  ).launchView('LinearSyntenyView', {
    views: [
      { loc: 'Pp01:1..1,000,000', assembly: 'peach' },
      { loc: 'chr1:1..1,000,000', assembly: 'grape' },
    ],
    tracks: [tracks],
  })
  view.setWidth(800)
  await waitFor(
    () => {
      expect(view.initialized).toBe(true)
    },
    { timeout: 30000 },
  )
  const level = view.levels[0]
  const { calls, backend } = fakeSyntenyBackend()
  level.startRenderingBackend(backend)
  await waitFor(
    () => {
      expect(level.settled).toBe(true)
      expect(calls.rendered.at(-1)?.perTrack.size).toBe(tracks.length)
    },
    { timeout: 30000 },
  )
  return { view, level, calls }
}

test('dotplot: hiding the last track repaints the canvas empty', async () => {
  const { view, calls } = await loadedDotplot(['subset'])
  const [key] = view.dotplotDisplays.map(
    (d: { displayKey: number }) => d.displayKey,
  )

  const rendersBefore = calls.rendered.length
  view.hideTrack('subset')

  await waitFor(() => {
    expect(calls.deleted).toStrictEqual([key])
  })
  // the last frame drawn must not be the one with the track still in it
  expect(calls.rendered.length).toBeGreaterThan(rendersBefore)
  expect(calls.rendered.at(-1)).toStrictEqual([])
  // and the view still reports finished over the canvas it just wiped —
  // `paintInert` is what says a plot with no tracks has nothing coming
  expect(view.painted).toBe(true)
}, 45000)

// keys are hashed per display, so hiding one evicts exactly its slot and the
// survivor keeps the slot it already owns. With index keys the survivor was
// renumbered onto the departed track's slot — the eviction and the rename raced
// over one buffer. (The survivor may still legitimately re-upload here: its
// automatic palette slot is assigned from the track list, so losing a sibling
// recomputes its colors.)
test('dotplot: hiding one of two leaves the survivor drawn under its own key', async () => {
  const { view, calls } = await loadedDotplot(['subset', 'peach_grape_small'])
  const [hiddenKey, survivorKey] = view.dotplotDisplays.map(
    (d: { displayKey: number }) => d.displayKey,
  )

  view.hideTrack('subset')

  await waitFor(() => {
    expect(calls.rendered.at(-1)).toStrictEqual([survivorKey])
  })
  expect(calls.deleted).toStrictEqual([hiddenKey])
  expect(view.dotplotDisplays[0].displayKey).toBe(survivorKey)
}, 45000)

test('synteny: hiding the last track repaints the level empty', async () => {
  const { view, level, calls } = await loadedSynteny(['subset'])
  const [key] = level.linearSyntenyDisplays.map(
    (d: { displayKey: number }) => d.displayKey,
  )

  const rendersBefore = calls.rendered.length
  view.hideTrack('subset')

  await waitFor(() => {
    expect(calls.deleted).toStrictEqual([key])
  })
  expect(calls.rendered.length).toBeGreaterThan(rendersBefore)
  expect(calls.rendered.at(-1)?.perTrack.size).toBe(0)
}, 45000)
