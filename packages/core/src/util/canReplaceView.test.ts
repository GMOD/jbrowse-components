import { canReplaceView } from './types/index.ts'

import type { AbstractSessionModel, AbstractViewModel } from './types/index.ts'

// Duck-typed to the two members isSessionModel looks for plus the slot list —
// the real thing is a whole product session, and none of the rest is read here.
function makeSession(
  views: unknown[],
  { replaceable = true } = {},
): AbstractSessionModel {
  return {
    rpcManager: {},
    configuration: {},
    views,
    ...(replaceable ? { replaceView: () => {} } : {}),
  } as unknown as AbstractSessionModel
}

const view = { id: 'v1' } as unknown as AbstractViewModel

test('a session view of a session that can replace views can be replaced', () => {
  expect(canReplaceView(makeSession([view]), view)).toBe(true)
})

test('no source view is nothing to replace', () => {
  expect(canReplaceView(makeSession([view]), undefined)).toBe(false)
})

// the single-view embedded products: addView destructively replaces their one
// view, which is a different contract with the same words
test('a session with no replaceView cannot be offered the choice', () => {
  expect(
    canReplaceView(makeSession([view], { replaceable: false }), view),
  ).toBe(false)
})

// The case every inline copy of this guard got wrong. A launcher resolves its
// source with getContainingView, which inside a LinearSyntenyView returns the
// row's inner LGV — no session slot, so replaceView falls through to addView and
// the button appends while saying it replaces.
test('a view the session does not hold a slot for cannot be replaced', () => {
  const row = { id: 'row0' } as unknown as AbstractViewModel
  expect(canReplaceView(makeSession([view]), row)).toBe(false)
})
