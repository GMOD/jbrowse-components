import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import GlobalFetchMixin from './GlobalFetchMixin.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// A display in a view that is itself nested in another view — the synteny
// view's rows, the breakpoint split view's panels. Only the OUTER view has a
// container writing `bodyMounted`, so the row's own flag stays at its default
// `true` while the whole subtree is out of the DOM, and the row's displays wait
// for a first paint that nothing will ever make.
function nestedDisplay({ outerRendersDisplays = true } = {}) {
  const Display = types
    .compose(
      'TestNestedDisplay',
      GlobalFetchMixin(),
      types.model({ type: types.literal('TestNestedDisplay') }),
    )
    .volatile(() => ({
      isMinimized: false,
    }))
    .actions(self => ({
      setMinimized(flag: boolean) {
        self.isMinimized = flag
      },
    }))
  const Row = types
    .compose(
      'TestRow',
      BaseViewModel,
      types.model({
        type: types.literal('TestRow'),
        display: Display,
      }),
    )
    .volatile(() => ({
      initialized: true,
      hasVisibleContent: true,
    }))
  const Stack = types
    .compose(
      'TestStack',
      BaseViewModel,
      types.model({
        type: types.literal('TestStack'),
        views: types.array(Row),
      }),
    )
    .views(() => ({
      get rendersDisplays() {
        return outerRendersDisplays
      },
    }))
  const stack = Stack.create({
    type: 'TestStack',
    views: [{ type: 'TestRow', display: { type: 'TestNestedDisplay' } }],
  })
  const row = stack.views[0]!
  const display: Instance<typeof Display> = row.display
  return { stack, row, display }
}

test('a display in a mounted row waits for its first paint', () => {
  const { display } = nestedDisplay()
  expect(display.displayPhase).toBe('loading')
})

test('the row excuses the paint its own container will never make', () => {
  const { row, display } = nestedDisplay()
  row.setBodyMounted(false)
  expect(display.displayPhase).toBe('ready')
})

test('an unmounted outer view excuses the paint of a display in its rows', () => {
  const { stack, row, display } = nestedDisplay()
  stack.setBodyMounted(false)
  expect(row.bodyMounted).toBe(true)
  expect(display.displayPhase).toBe('ready')
})

test('scrolling the outer view back puts the wait back', () => {
  const { stack, display } = nestedDisplay()
  stack.setBodyMounted(false)
  stack.setBodyMounted(true)
  expect(display.displayPhase).toBe('loading')
})

test('an observed phase hears the outer view scroll off and back', () => {
  const { stack, display } = nestedDisplay()
  const seen: string[] = []
  const dispose = autorun(() => {
    seen.push(display.displayPhase)
  })
  stack.setBodyMounted(false)
  stack.setBodyMounted(true)
  dispose()
  expect(seen).toEqual(['loading', 'ready', 'loading'])
})

test('a minimized display in a mounted row waits for nothing', () => {
  const { display } = nestedDisplay()
  const seen: string[] = []
  const dispose = autorun(() => {
    seen.push(display.displayPhase)
  })
  display.setMinimized(true)
  display.setMinimized(false)
  dispose()
  expect(seen).toEqual(['loading', 'ready', 'loading'])
})

test('an outer view that renders no displays of its own leaves its rows waiting', () => {
  const { display } = nestedDisplay({ outerRendersDisplays: false })
  expect(display.displayPhase).toBe('loading')
})
