import '../components/enableReactRenderLogging.ts'
import '@testing-library/jest-dom'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import { renderLoggedComponents } from '../components/renderLogRecord.ts'
import { measure, suppressTeardownNoise } from './teardownNoise.ts'
import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { WebRootModel } from '../rootModel/rootModel.ts'

setup()

const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }

suppressTeardownNoise()
const opts = [{}, delay] as const

// Undo is the second door into ADR-069, and the one the rule was not applied
// at. `TimeTraveller.undo()` / `redo()` is `applySnapshot` on the whole session;
// every view, track and display carries an `ElementId`, so MST reconciles by
// identifier and DESTROYS whatever the target snapshot lacks — synchronously,
// inside the action, with the components still mounted and the action's
// reactions due at its `endBatch`. `removeView` detaches precisely to avoid
// that sequence, and nothing routed the snapshot apply through it.
//
// Reachable from a document-level keydown and from the File menu, and it is not
// a rare corner: any undo crossing a view add or remove, a track close, or a
// `replaceView` takes it.

async function sessionWithTrack() {
  const { view, session, rootModel } = await createView(config)
  await view.navToLocString('ctgA:1..8000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)
  return { view, session, history: (rootModel as WebRootModel).history }
}

// TimeTraveller records 300ms after the last patch, so "the state I just made is
// undoable" is a wait, not a fact. Waiting on the CONTENT of the newest entry
// rather than on `undoIdx`, which saturates at MAX_HISTORY_LENGTH - 1 and then
// never moves again.
interface Snap {
  views: { tracks: unknown[] }[]
}
async function recorded(
  history: WebRootModel['history'],
  pred: (s: Snap) => boolean,
) {
  await waitFor(() => {
    const snap = history.history[history.undoIdx] as Snap | undefined
    expect(!!snap && pred(snap)).toBe(true)
  }, delay)
}

// The whole sequence, on the real recorder: close a view, undo it back, look at
// it, redo. The redo is the destroying direction — the session has a view the
// target snapshot does not — and it is measured with the restored view fully
// repainted, because a view React has not finished mounting has no observers to
// read it dead and would pass this for the wrong reason.
//
// Before the fix: 4 liveliness reads of the display, plus `[findParentThat] node
// has no parent: alive=false type=LinearVariantDisplay` — `getContainingView`'s
// throwing branch really running, on a node a component was rendering. It did
// not reach a boundary only because the same action also empties `session.views`,
// so React unmounts the component in the same update and never reads the
// computed the exception was stored in. That containment is incidental, and it
// is the difference between this and the crash ADR-069 was written for.
test('undo and redo across a closed view do not read the view they took out', async () => {
  const { view, session, history } = await sessionWithTrack()
  await recorded(history, s => s.views[0]?.tracks.length === 1)

  act(() => {
    session.removeView(view)
  })
  await recorded(history, s => s.views.length === 0)

  const undoLog = measure(() => {
    history.undo()
  })
  expect(session.views).toHaveLength(1)
  const restored = session.views[0]!
  await findAnyDisplayPainted(delay)
  await waitFor(() => {
    expect(restored.initialized).toBe(true)
  }, delay)

  // The half that keeps the redo honest: `addUndoState` truncates the forward
  // history, so a patch landing in the 300ms after the undo would leave nothing
  // to redo and this test would measure an empty action. It does not — the
  // restored view's repaint is volatile state and patches nothing — which is
  // also what makes the redo reachable for a real user.
  expect(history.canRedo).toBe(true)
  const redoLog = measure(() => {
    history.redo()
  })
  expect(session.views).toHaveLength(0)

  expect(undoLog.thrown).toEqual([])
  expect(undoLog.deadReads).toEqual([])
  expect(redoLog.thrown).toEqual([])
  expect(redoLog.deadReads).toEqual([])
  // and React's dev-mode render logging really ran, which is what walks four
  // levels into a component's props and reaches nodes nothing rendered directly
  expect(renderLoggedComponents().length).toBeGreaterThan(0)

  // and the view really is destroyed, not detached and forgotten: `beforeDestroy`
  // is where BaseTrackModel releases the rpcSessionId claim that lets
  // CoreFreeResources evict the parsed adapter from the worker
  await waitFor(() => {
    expect(isAlive(restored)).toBe(false)
  }, delay)
}, 60000)

// The scope of the rule, pinned from the other side. A track the target snapshot
// drops is destroyed in place, and that is deliberate: the ordinary close-a-
// track path is the same `tracks.remove` and measures LOUDER, so routing the
// snapshot apply through a detach here would not be applying an existing
// discipline, it would be inventing one — and a worse one. A detached display is
// a LIVE root, so `getContainingView` throws on it where a destroyed one only
// warns.
//
// What this asserts is therefore the severity, not the count: every read is of a
// scalar or a reference on the display, and nothing walks. It fails if either
// path starts throwing.
test('undoing a track open is no worse than closing the track', async () => {
  const { view, history } = await sessionWithTrack()
  await recorded(history, s => s.views[0]?.tracks.length === 1)

  const viaHideTrack = measure(() => {
    view.hideTrack('volvox_test_vcf')
  })
  await recorded(history, s => s.views[0]?.tracks.length === 0)

  act(() => {
    history.undo()
  })
  expect(view.tracks).toHaveLength(1)
  await findAnyDisplayPainted(delay)

  expect(history.canRedo).toBe(true)
  const viaSnapshot = measure(() => {
    history.redo()
  })
  expect(view.tracks).toHaveLength(0)

  const onlyDisplayScalars = (reads: string[]) =>
    reads.every(
      r =>
        r.includes("Object type: 'LinearCanvasBaseDisplay'") &&
        /Subpath: '(configuration|type)'/.test(r),
    )
  expect(viaHideTrack.thrown).toEqual([])
  expect(viaSnapshot.thrown).toEqual([])
  expect(viaHideTrack.deadReads.length).toBeGreaterThan(0)
  expect(onlyDisplayScalars(viaHideTrack.deadReads)).toBe(true)
  expect(viaSnapshot.deadReads.length).toBeGreaterThan(0)
  expect(onlyDisplayScalars(viaSnapshot.deadReads)).toBe(true)
}, 60000)
