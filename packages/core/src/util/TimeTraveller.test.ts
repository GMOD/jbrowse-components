import { types } from '@jbrowse/mobx-state-tree'

import TimeTraveller from './TimeTraveller.ts'

// A minimal store to target. TimeTraveller watches this via env.targetStore.
const TargetStore = types.model('Target', { value: 0 }).actions(self => ({
  setValue(v: number) {
    self.value = v
  },
}))

function makeStores() {
  const target = TargetStore.create({ value: 0 })
  const undo = TimeTraveller.create(
    { undoIdx: -1, targetPath: '' },
    { targetStore: target },
  )
  undo.initialize()
  return { target, undo }
}

// Advance fake timers past the 300 ms debounce
function flushDebounce() {
  jest.advanceTimersByTime(300)
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('records initial state and a change', () => {
  const { target, undo } = makeStores()
  expect(undo.history).toHaveLength(1)

  target.setValue(1)
  flushDebounce()

  expect(undo.history).toHaveLength(2)
  expect(undo.canUndo).toBe(true)
})

test('undo restores previous value', () => {
  const { target, undo } = makeStores()
  target.setValue(42)
  flushDebounce()

  undo.undo()
  expect(target.value).toBe(0)
  expect(undo.canUndo).toBe(false)
})

test('redo re-applies the change', () => {
  const { target, undo } = makeStores()
  target.setValue(42)
  flushDebounce()

  undo.undo()
  expect(undo.canRedo).toBe(true)
  undo.redo()
  expect(target.value).toBe(42)
})

test('change after undo is recorded (skipNextUndoState reset regression)', () => {
  // Regression: after undo with no pending debounce, skipNextUndoState was
  // never reset to false. The next user change would be silently dropped from
  // undo history, so canUndo stayed false and the change was unrecoverable.
  const { target, undo } = makeStores()

  target.setValue(1)
  flushDebounce()
  // history: [0, 1], undoIdx=1

  undo.undo()
  // history: [0, 1], undoIdx=0 — no debounce pending at this point
  expect(target.value).toBe(0)

  target.setValue(2)
  flushDebounce()
  // history should be [0, 2] (undo truncated forward history, then recorded 2)

  expect(undo.canUndo).toBe(true)
  undo.undo()
  expect(target.value).toBe(0)
})

// Two fields, because `applySnapshot` emits one patch per changed leaf and the
// recorder listens to patches: an undo that restores more than one of them
// re-enters the recorder after the first patch has already consumed the skip.
// A single-field target can't show it — every applySnapshot there is one patch.
const WideStore = types.model('Wide', { a: 0, b: 0 }).actions(self => ({
  setBoth(a: number, b: number) {
    self.a = a
    self.b = b
  },
}))

function makeWideStores() {
  const target = WideStore.create({ a: 0, b: 0 })
  const undo = TimeTraveller.create(
    { undoIdx: -1, targetPath: '' },
    { targetStore: target },
  )
  undo.initialize()
  return { target, undo }
}

test('undoing a multi-field change leaves redo intact', () => {
  const { target, undo } = makeWideStores()
  target.setBoth(1, 1)
  flushDebounce()
  // history: [{0,0}, {1,1}], undoIdx=1

  undo.undo()
  expect(target).toMatchObject({ a: 0, b: 0 })
  // The undo's own patches must not be recorded — the trailing ones used to
  // schedule a debounce that then truncated the forward history.
  flushDebounce()

  expect(undo.history).toHaveLength(2)
  expect(undo.canRedo).toBe(true)
  undo.redo()
  expect(target).toMatchObject({ a: 1, b: 1 })
})

test('a second undo of multi-field changes keeps walking back', () => {
  const { target, undo } = makeWideStores()
  target.setBoth(1, 1)
  flushDebounce()
  target.setBoth(2, 2)
  flushDebounce()
  // history: [{0,0}, {1,1}, {2,2}], undoIdx=2

  undo.undo()
  flushDebounce()
  expect(target).toMatchObject({ a: 1, b: 1 })

  // A recorded undo re-pushes the state just restored, so undoIdx lands back on
  // it and this second undo appeared to do nothing at all.
  undo.undo()
  flushDebounce()
  expect(target).toMatchObject({ a: 0, b: 0 })
})

// Mirrors HistoryManagementMixin: the TimeTraveller sits next to a `session`
// prop that the root replaces wholesale, and its init autorun re-fires each time.
const Root = types
  .model('Root', {
    session: types.optional(TargetStore, { value: 0 }),
    history: types.optional(TimeTraveller, { targetPath: '../session' }),
  })
  .actions(self => ({
    setSession(value: number) {
      self.session = TargetStore.create({ value })
    },
  }))

test('re-initializing for a new session resets history', () => {
  // Regression: initialize() re-runs on every setSession, but skipped its
  // baseline once history was non-empty and never disposed the old onSnapshot.
  // `history` is volatile while `undoIdx` is a persisted prop, so undo applied
  // the *previous* session's snapshot to the new session.
  const root = Root.create()
  root.history.initialize()

  root.session.setValue(1)
  flushDebounce()
  expect(root.history.history).toHaveLength(2)
  expect(root.history.undoIdx).toBe(1)

  root.setSession(100)
  root.history.initialize()

  expect(root.history.history).toEqual([{ value: 100 }])
  expect(root.history.undoIdx).toBe(0)
  expect(root.history.canUndo).toBe(false)

  // and undo now walks the new session's history, not the old one's
  root.session.setValue(101)
  flushDebounce()
  root.history.undo()
  expect(root.session.value).toBe(100)
})

test('undo during pending debounce does not record the undone change', () => {
  // If the user makes a change (debounce starts) then immediately undoes,
  // the debounce should be cancelled — we must not add the change to history.
  const { target, undo } = makeStores()

  target.setValue(1)
  flushDebounce()
  // history: [0, 1], undoIdx=1

  target.setValue(2)
  // debounce is now pending but not yet fired

  undo.undo()
  // undo to value=0, debounce must be cancelled

  // don't flush — if debounce still fired it would add value=2 back
  expect(target.value).toBe(0)
  expect(undo.history).toHaveLength(2) // only [0, 1], not [0, 1, 2]
})
