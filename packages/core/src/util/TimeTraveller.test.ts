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
