import { createTestSession } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// The half of a spec `layout` that a stubbed `applyLayoutSpec` cannot show:
// that feeding its return value to `orderViews` is what makes the stated order
// the order a tab renders in. Two functions have to agree for that to hold —
// `viewIdsInSpec` (depth-first, the order stated) and `applyOrderWithin` (a
// slot permutation of `session.views`) — and neither is exercised by
// `loadSessionSpec.test.ts`, which stubs the session.
test('a stated within-tab order is what the tab renders', () => {
  const session = createTestSession()
  const a = session.addView('LinearGenomeView', {}).id
  const b = session.addView('LinearGenomeView', {}).id
  session.setUseWorkspaces(true)

  // the spec stacks b above a, the reverse of the order they were added in
  session.orderViews(session.applyLayoutSpec({ views: [b, a] }))

  const tabId = session.tabs[0]!.id
  // `viewIds` is membership, so it held this order all along — the assertion
  // that matters is the next one, which is what WorkspaceContainer's `viewsOf`
  // computes for the stack it draws
  expect([...session.tabs[0]!.viewIds]).toEqual([b, a])
  expect(
    session.viewIdsForTab(
      tabId,
      session.views.map(v => v.id),
    ),
  ).toEqual([b, a])
})

test('an order for one panel leaves the views of another where they sit', () => {
  const session = createTestSession()
  const a = session.addView('LinearGenomeView', {}).id
  const b = session.addView('LinearGenomeView', {}).id
  const c = session.addView('LinearGenomeView', {}).id
  session.setUseWorkspaces(true)

  // left panel keeps launch order; right panel reverses its own
  session.orderViews(
    session.applyLayoutSpec({
      direction: 'horizontal',
      children: [{ views: [a] }, { views: [c, b] }],
    }),
  )

  const order = session.views.map(v => v.id)
  const [left, right] = session.panels
  expect(session.viewIdsForTab(left!.tabs[0]!.id, order)).toEqual([a])
  expect(session.viewIdsForTab(right!.tabs[0]!.id, order)).toEqual([c, b])
})
