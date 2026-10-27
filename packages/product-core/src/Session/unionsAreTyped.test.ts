import type { SessionWithConnections } from './Connections.ts'
import type { SessionWithDrawerWidgets } from './DrawerWidgets.ts'
import type { SessionWithMultipleViews } from './MultipleViews.ts'
import type { IsAny } from '@jbrowse/core/util/types'

type ValueOf<M> = M extends { get(key: string): infer V } ? V : never

// Typecheck-only: a plugin union reads as `any` unless `pluggableMstType` names
// what its members are, and `any` here unchecks every view, widget and
// connection read off a session.
test('the session view, widget and connection lists are typed', () => {
  const pins: [
    IsAny<SessionWithMultipleViews['views'][number]>,
    IsAny<ReturnType<SessionWithMultipleViews['addView']>>,
    IsAny<ValueOf<SessionWithDrawerWidgets['widgets']>>,
    IsAny<ValueOf<SessionWithDrawerWidgets['activeWidgets']>>,
    IsAny<ReturnType<SessionWithDrawerWidgets['addWidget']>>,
    IsAny<SessionWithConnections['connectionInstances'][number]>,
  ] = [false, false, false, false, false, false]
  expect(pins).toEqual([false, false, false, false, false, false])
})
