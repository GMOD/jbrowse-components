import { getShareableSessionSnapshot } from '@jbrowse/product-core'

import { createTestSession } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// What an exported `session.json` or a share link carries of the workspace
// layout, and what the recipient does with it. The layout model homes views
// into tabs as they arrive, so a snapshot with no assignments still opens with
// every view in a tab.

type Session = ReturnType<typeof createTestSession>

function addViews(session: Session, n: number) {
  for (let i = 0; i < n; i++) {
    session.addView('LinearGenomeView', {})
  }
  return session.views.map(v => v.id)
}

function reopen(session: Session) {
  return createTestSession({
    sessionSnapshot: getShareableSessionSnapshot(session),
  })
}

test('an exported workspace keeps its tabs', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  session.moveViewToNewTab(second!)

  const reopened = reopen(session)

  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first], [second]])
  expect(reopened.views.map(v => v.id)).toEqual([first, second])
})

test('a session exported with no layout comes back as one stack', () => {
  const session = createTestSession()
  const ids = addViews(session, 2)
  const { layout, activePanelId, ...rest } =
    getShareableSessionSnapshot(session)

  const reopened = createTestSession({ sessionSnapshot: rest })

  expect(reopened.panels).toHaveLength(1)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([ids])
})

test('an arrangement made by dragging travels with the session', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  session.splitPanel(session.panels[0]!.id, 'row')

  const reopened = reopen(session)

  expect(reopened.panels).toHaveLength(2)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first, second], []])
  // the empty cell is a real one: a tab with no views is the view launcher,
  // not something the recipient's homing should absorb
  expect(reopened.panels).toHaveLength(2)
})

// A session saved while the workspace was switched off showed its views
// stacked, whatever layout it carried, so it still opens that way
test('a session saved with workspaces off opens as the stack it showed', () => {
  const session = createTestSession()
  const ids = addViews(session, 2)
  session.splitPanel(session.panels[0]!.id, 'row')

  const reopened = createTestSession({
    sessionSnapshot: {
      ...getShareableSessionSnapshot(session),
      useWorkspaces: false,
    },
  })

  expect(reopened.panels).toHaveLength(1)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([ids])
})

test('a view closed before export does not come back as a phantom tab entry', () => {
  const session = createTestSession()
  const [first, second] = addViews(session, 2)
  session.moveViewToNewTab(second!)
  session.removeView(session.views[1]!)

  const reopened = reopen(session)
  expect(reopened.tabs.flatMap(t => [...t.viewIds])).toEqual([first])
})
