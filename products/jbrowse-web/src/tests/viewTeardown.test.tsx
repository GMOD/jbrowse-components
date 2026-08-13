import '@testing-library/jest-dom'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

// Taking a view out of a session destroyed it in place, inside the action, and
// MobX runs an action's pending reactions at the `endBatch` closing it — so
// everything mounted over that view got a final run against nodes that had just
// died. ADR-069's rule, at three call sites it had not been applied to.
//
// A view is worse than the session `setSession` fixed, because a DISPLAY is the
// thing rendering under it: `getContainingView` walks parents and throws when
// there is none, so where a session switch produced liveliness warnings on
// scalars, this produced `Error: no containing view found` into an
// ErrorBoundary — and with no view left to catch it, the boundary was the app's
// and the whole page went. The figure sweep saw exactly that on
// `cancer_sv/multihop_split_view`: the warnings, the throw, then a missing
// `[aria-label="JBrowse"]`.
//
// So both are asserted, and the throws separately from the warnings: they are
// two severities of one bug and only one of them takes the page.
function captureTeardownNoise() {
  const deadReads: string[] = []
  const thrown: string[] = []
  const origWarn = console.warn
  const origError = console.error
  const capture = (...args: unknown[]) => {
    const first = args[0]
    const text =
      first instanceof Error ? first.stack || first.message : `${first}`
    if (text.includes('no longer part of a state tree')) {
      deadReads.push(text.split('\n')[0]!)
    } else if (
      text.includes('no containing view found') ||
      text.includes('no session model found') ||
      text.includes('node does not have parent')
    ) {
      thrown.push(text.split('\n')[0]!)
    } else {
      origWarn(...(args as []))
    }
  }
  console.warn = capture
  console.error = capture
  return {
    deadReads,
    thrown,
    restore() {
      console.warn = origWarn
      console.error = origError
    },
  }
}

// A track OPEN in the view, because that is what makes this measurable: a bare
// view has no display under it, and a display's reads are the ones that throw.
async function viewWithTrack() {
  const { view, session } = await createView(config)
  await view.navToLocString('ctgA:1..8000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)
  return { view, session }
}

// Scoped to the action and the reaction flush closing it, and deliberately not
// to the deferred teardown after — the same line `sessionSwitchTeardown` draws,
// for the same reason. That window is the one that matters and the one that is
// deterministic: components are still mounted over the view there, so a read is
// a read of something being rendered. Destroying the detached tree afterwards
// still produces a couple, because killing an MST tree invalidates computeds
// inside it that something is observing; asserting zero there would promise what
// this design does not give. The synchronous `act` is what draws the line — it
// flushes React and MobX but not the `setTimeout(0)`.
function measure(fn: () => void) {
  const log = captureTeardownNoise()
  try {
    act(fn)
  } finally {
    log.restore()
  }
  return log
}

test('removeView does not read the view it took out', async () => {
  const { view, session } = await viewWithTrack()

  const log = measure(() => {
    session.removeView(view)
  })

  expect(log.thrown).toEqual([])
  expect(log.deadReads).toEqual([])

  // and it is really destroyed, not detached and forgotten: `beforeDestroy` is
  // where BaseTrackModel releases the rpcSessionId claim that lets
  // CoreFreeResources evict the parsed adapter from the worker, so a view that
  // stayed alive forever would leak one per closed view.
  await waitFor(() => {
    expect(isAlive(view)).toBe(false)
  }, delay)
}, 60000)

test('replaceView does not read the view it swapped out', async () => {
  const { view, session } = await viewWithTrack()

  const log = measure(() => {
    session.replaceView(view, 'LinearGenomeView')
  })

  expect(log.thrown).toEqual([])
  expect(log.deadReads).toEqual([])
  await waitFor(() => {
    expect(isAlive(view)).toBe(false)
  }, delay)
}, 60000)

// The half of the detach that would have broken silently, and the reason
// `beforeDetach` carries this rather than `beforeDestroy` alone. A comparative
// view synthesizes a read-vs-ref assembly nothing else owns, and gives it back
// when it closes. Detach the view first and that hook runs on a root, where
// `getSession` throws — so `releaseTemporaryAssemblies` guards on `hasParent`,
// and a guard is exactly the shape that turns a broken teardown into a leak
// with nothing said. This is the assertion that would notice.
test('a comparative view gives its temporary assembly back when removed', async () => {
  const { session } = await createView(config)

  session.addTemporaryAssembly({
    name: 'readvsref',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'readvsref-ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'readvsref',
            uniqueId: 'readvsref-1',
            start: 0,
            end: 10,
            seq: 'ACGTACGTAC',
          },
        ],
      },
    },
  })
  expect(session.temporaryAssemblies.map(a => a.name)).toContain('readvsref')

  const dotplot = session.addView('DotplotView', {
    assemblyNames: ['readvsref'],
  })
  act(() => {
    session.removeView(dotplot)
  })

  expect(session.temporaryAssemblies.map(a => a.name)).not.toContain(
    'readvsref',
  )
}, 60000)
