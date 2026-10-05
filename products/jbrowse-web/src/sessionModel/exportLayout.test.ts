import { getShareableSessionSnapshot } from '@jbrowse/product-core'

import { createTestSession } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// What an exported `session.json` or a share link carries of the workspace
// layout, and what the recipient does with it. Homing views into tabs is an
// autorun in `WorkspaceContainer`, so a snapshot taken before it ran holds no
// assignments; these pin that the recipient still ends up with every view.

type Session = ReturnType<typeof createTestSession>

function addViews(session: Session, n: number) {
  for (let i = 0; i < n; i++) {
    session.addView('LinearGenomeView', {})
  }
  return session.views.map(v => v.id)
}

// stands in for WorkspaceContainer's mount: the autorun that gives every view
// no tab holds a home
function mountWorkspace(session: Session) {
  session.homeUnassignedViews(session.views.map(v => v.id))
}

function reopen(session: Session) {
  return createTestSession({
    sessionSnapshot: getShareableSessionSnapshot(session),
  })
}

test('an exported workspace keeps its tabs', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  mountWorkspace(session)
  session.moveViewToNewTab(second, [first!, second!])

  const reopened = reopen(session)

  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first], [second]])
  expect(reopened.views.map(v => v.id)).toEqual([first, second])
})

test('a session exported before homing ran comes back as one stack', () => {
  const session = createTestSession()
  const ids = addViews(session, 2)
  expect(session.tabs.flatMap(t => [...t.viewIds])).toEqual([])

  const reopened = reopen(session)
  mountWorkspace(reopened)

  expect(reopened.panels).toHaveLength(1)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([ids])
})

test('an arrangement made by dragging travels with the session', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  mountWorkspace(session)
  session.splitPanel(session.panels[0]!.id, 'row')

  const reopened = reopen(session)

  expect(reopened.panels).toHaveLength(2)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first, second], []])
  // the empty cell is a real one: a tab with no views is the view launcher,
  // not something the recipient's homing pass should absorb
  mountWorkspace(reopened)
  expect(reopened.panels).toHaveLength(2)
})

// A session saved while the workspace was switched off showed its views
// stacked, whatever layout it carried, so it still opens that way
test('a session saved with workspaces off opens as the stack it showed', () => {
  const session = createTestSession()
  const ids = addViews(session, 2)
  mountWorkspace(session)
  session.splitPanel(session.panels[0]!.id, 'row')

  const reopened = createTestSession({
    sessionSnapshot: {
      ...getShareableSessionSnapshot(session),
      useWorkspaces: false,
    },
  })
  mountWorkspace(reopened)

  expect(reopened.panels).toHaveLength(1)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([ids])
})

test('a view closed before export does not come back as a phantom tab entry', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  mountWorkspace(session)
  session.moveViewToNewTab(second, [first!, second!])
  session.removeView(session.views[1])

  const reopened = reopen(session)
  // the layout is pruned on the next homing rather than at removal, so the
  // snapshot can hold a tab naming a view that is gone. What matters is that
  // the recipient never renders one.
  mountWorkspace(reopened)
  expect(reopened.tabs.flatMap(t => [...t.viewIds])).toEqual([first])
})
