import { getShareableSessionSnapshot } from '@jbrowse/product-core'

import { createTestSession } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// What an exported `session.json` or a share link carries of the workspace
// layout, and what the recipient does with it. The two halves are owned by
// different code — `getShareableSessionSnapshot` is a plain snapshot, and the
// homing of views into tabs is an autorun in `WorkspaceContainer` that only
// runs while workspaces are on — so what a recipient ends up looking at is not
// obvious from either one alone, and the empty `tabs[0].viewIds` in
// ExportSession's snapshot reads like a loss until both are pinned.

type Session = ReturnType<typeof createTestSession>

function addViews(session: Session, n: number) {
  for (let i = 0; i < n; i++) {
    session.addView('LinearGenomeView', {})
  }
  return session.views.map(v => v.id)
}

// stands in for WorkspaceContainer's mount: the autorun that gives every view
// no tab holds a home. Nothing else assigns views to tabs, which is why a
// session that never had workspaces on exports an empty layout.
function mountWorkspace(session: Session) {
  session.homeUnassignedViews(session.views.map(v => v.id))
}

function reopen(session: Session) {
  return createTestSession({
    sessionSnapshot: getShareableSessionSnapshot(session),
  })
}

test('an exported workspace keeps its tabs, and says it is a workspace', () => {
  const session = createTestSession()
  session.setUseWorkspacesPreference(true)
  const [first, second] = addViews(session, 2)
  mountWorkspace(session)
  session.moveViewToNewTab(second, [first!, second!])

  const reopened = reopen(session)

  // `useWorkspaces` rides along as a session property, so the recipient sees
  // the workspace whatever their own preference is — the layout would
  // otherwise be there and invisible
  expect(reopened.effectiveUseWorkspaces).toBe(true)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first], [second]])
  expect(reopened.views.map(v => v.id)).toEqual([first, second])
})

test('a classic-stack session exports no assignments, and the reader makes its own', () => {
  // Nothing homed these: the workspace was never up. This is the case behind
  // ExportSession's snapshot, and it is not a loss — there is no arrangement
  // to carry, and one stack is one tab.
  const session = createTestSession()
  const ids = addViews(session, 2)
  expect(session.tabs.flatMap(t => [...t.viewIds])).toEqual([])

  const reopened = reopen(session)
  expect(reopened.effectiveUseWorkspaces).toBe(false)

  // the recipient turns workspaces on and mounts the container
  reopened.setUseWorkspacesPreference(true)
  mountWorkspace(reopened)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([ids])
})

test('a workspace arranged only by dragging still says it is a workspace', () => {
  // The gap the test above cannot see, because `setUseWorkspacesPreference`
  // writes the session property itself. Here the workspace is on because the
  // ADMIN turned it on, and the arrangement is built entirely by the gestures
  // the tab strip offers — none of which touch the preference, since
  // WorkspaceLayoutMixin owns the tree and nothing else. So the raw property is
  // undefined and the intent reaches the recipient only if the export resolves
  // the cascade (`bakeWorkspacesIntent`).
  const session = createTestSession({
    jbrowseConfig: { configuration: { preferences: { useWorkspaces: true } } },
  })
  const [first, second] = addViews(session, 2)
  mountWorkspace(session)
  // the panel's own split button: a pure layout gesture, and one of the several
  // that never go near the preference
  session.splitPanel(session.panels[0]!.id, 'row')
  expect(session.useWorkspaces).toBeUndefined()

  // the recipient is on a deployment whose admin default is the shipped false,
  // so their own cascade says classic stack
  const reopened = reopen(session)

  expect(reopened.effectiveUseWorkspaces).toBe(true)
  expect(reopened.panels).toHaveLength(2)
  expect(reopened.tabs.map(t => [...t.viewIds])).toEqual([[first, second], []])
  // and the empty cell is a real one — a tab with no views is the view
  // launcher, not something the recipient's homing pass should absorb
  mountWorkspace(reopened)
  expect(reopened.panels).toHaveLength(2)
})

test('an export with nothing arranged leaves the choice to the recipient', () => {
  // The other half of the rule: only the on case is baked. A classic-stack
  // sender has no arrangement to carry, so stamping `false` would be a sender
  // with nothing to say overriding a recipient who prefers workspaces.
  const session = createTestSession()
  addViews(session, 2)

  const snap = getShareableSessionSnapshot(session)
  expect(snap.useWorkspaces).toBeUndefined()

  const recipient = createTestSession({
    jbrowseConfig: { configuration: { preferences: { useWorkspaces: true } } },
    sessionSnapshot: snap,
  })
  expect(recipient.effectiveUseWorkspaces).toBe(true)
})

test('a view closed before export does not come back as a phantom tab entry', () => {
  const session = createTestSession()
  session.setUseWorkspacesPreference(true)
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
