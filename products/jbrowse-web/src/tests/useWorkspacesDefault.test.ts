import { createTestSession } from '../rootModel/index.ts'

jest.mock('../makeWorkerInstance', () => () => {})

// createTestSession builds the root model then calls setSession({name}), which
// is the same bare-session path loadSessionSpec/loadHubSpec take — the arrivals
// that never see `defaultSession`. So an admin default only reaches those users
// if it resolves through the preferences config, not the session snapshot.
function sessionWith(useWorkspaces?: boolean) {
  return createTestSession({
    jbrowseConfig: { configuration: { preferences: { useWorkspaces } } },
  })
}

test('workspaces defaults off with no admin default', () => {
  expect(sessionWith().effectiveUseWorkspaces).toBe(false)
})

test('a bare session (spec/hub arrival) picks up the admin default', () => {
  expect(sessionWith(true).effectiveUseWorkspaces).toBe(true)
})

test("a session snapshot's own value beats the admin default", () => {
  const session = createTestSession({
    jbrowseConfig: { configuration: { preferences: { useWorkspaces: true } } },
    sessionSnapshot: { useWorkspaces: false },
  })
  expect(session.effectiveUseWorkspaces).toBe(false)
})

test("a user's toggle beats the admin default and persists as an override", () => {
  const session = sessionWith(true)
  session.setUseWorkspacesPreference(false)

  expect(session.effectiveUseWorkspaces).toBe(false)
  expect(session.getPreferenceChanges()).toEqual([
    { path: ['useWorkspaces'], from: true, to: false },
  ])

  session.resetUseWorkspaces()
  expect(session.effectiveUseWorkspaces).toBe(true)
  expect(session.getPreferenceChanges()).toEqual([])
})

// the session-scoped setter is what a spec `layout` uses: it must not rewrite
// the visitor's own preference
test('setUseWorkspaces is session-scoped and writes no override', () => {
  const session = sessionWith()
  session.setUseWorkspaces(true)

  expect(session.effectiveUseWorkspaces).toBe(true)
  expect(session.getPreferenceChanges()).toEqual([])
})
