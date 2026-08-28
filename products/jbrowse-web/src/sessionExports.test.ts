import { SESSION_AND_PLUGIN_REMOVALS } from '@jbrowse/core/ReExports/knownRemovals'
import { createTestSession } from '@jbrowse/web/testUtils'

import baseline from './sessionExportsBaseline.json'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// The session's second runtime ABI, beside the plugin `exports` object
// pluginExports.test.ts pins: a plugin reaches the session by member lookup
// (`'x' in session`) at runtime rather than by import, so a name that leaves
// it is `undefined` with nothing thrown at the call site —
// `pluginFacingSessionApi.test.ts`'s own history (`setPendingMove`) is the
// case that stayed silent for eight commits.
//
// This baseline is wider than that hand-picked list: it is every member
// `Object.getOwnPropertyNames` finds walking the session's prototype chain
// (own state-tree properties, views and actions alike), snapshotted once and
// checked going forward. Removals fail here, additions don't — same doctrine
// as pluginExportsBaseline.json. To drop a name, delete it from
// sessionExportsBaseline.json in the same commit as the change.
//
// What this cannot catch is a signature: `getReferring` still resolves and
// still passes this test, because a name whose value changed shape rather
// than left is exactly what a presence check has nothing to say about — only
// pluginFacingSessionApi.test.ts's shape, performing the call the way a
// published bundle spells it, catches that class. Same limitation
// pluginExports.test.ts has, and for the same reason.
describe('session member ABI', () => {
  const session = createTestSession()

  it('keeps every member the baseline recorded', () => {
    const missing = baseline.filter(name => !(name in session))
    expect(missing).toEqual([])
  })

  it('has not brought back a member the removal record marked gone', () => {
    const sessionSurface = SESSION_AND_PLUGIN_REMOVALS.find(g =>
      g.surface.startsWith('**the session**'),
    )!
    const backAgain = Object.keys(sessionSurface.gone).filter(
      name => name in session,
    )
    expect(backAgain).toEqual([])
  })
})
