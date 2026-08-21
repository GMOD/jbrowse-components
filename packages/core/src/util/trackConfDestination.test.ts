import { addAndShowTrack } from './addAndShowTrack.ts'
import { addTrackFromWidget } from './addTrackFromWidget.ts'

import type { SessionWithAddSessionTrack } from './types/index.ts'

// The two shared tails, which is where the destination decision actually lands
// for most callers: five features reach `addAndShowTrack` and every Add-track
// workflow reaches `addTrackFromWidget`. Nothing but a call-through test can hold
// them apart — both compile against a session that has both actions, so swapping
// one for the other type-checks and renders identically, and the difference only
// shows up in an admin's config.json.
function fakeSession() {
  const calls: string[] = []
  const session = {
    // isSessionModel keys on these two rather than on MST node-ness
    rpcManager: {},
    configuration: {},
    addSessionTrackConf: (conf: { trackId: string }) => {
      calls.push(`session:${conf.trackId}`)
      return conf
    },
    publishTrackConf: (conf: { trackId: string }) => {
      calls.push(`publish:${conf.trackId}`)
      return conf
    },
    notify: () => {},
    notifyError: () => {},
  }
  return { calls, session }
}

const CONF = { trackId: 't1', type: 'FeatureTrack', assemblyNames: ['hg38'] }

test('addAndShowTrack adds to the session, and shows what it added', () => {
  const { calls, session } = fakeSession()
  const shown: string[] = []

  addAndShowTrack(session as unknown as SessionWithAddSessionTrack, CONF, {
    showTrack: (trackId: string) => shown.push(trackId),
  })

  expect(calls).toEqual(['session:t1'])
  expect(shown).toEqual(['t1'])
})

// The other half of that ordering, which the session-scoped switch must not have
// dropped: a rejected conf is not shown, because `addSessionTrackConf` has
// already put its own error on screen.
test('addAndShowTrack shows nothing when the add was rejected', () => {
  const { session } = fakeSession()
  const shown: string[] = []

  addAndShowTrack(
    {
      ...session,
      addSessionTrackConf: () => undefined,
    } as unknown as SessionWithAddSessionTrack,
    CONF,
    { showTrack: (trackId: string) => shown.push(trackId) },
  )

  expect(shown).toEqual([])
})

// An Add-track workflow is the one place an admin means the whole site, so this
// is the one tail that publishes.
test('addTrackFromWidget publishes, and does not touch the session store', () => {
  const { calls, session } = fakeSession()
  const shown: string[] = []

  addTrackFromWidget({
    model: {
      trackContainer: {
        assemblyNames: ['hg38'],
        showTrack: (trackId: string) => shown.push(trackId),
      },
      clearData: () => {},
    } as never,
    session: session as never,
    conf: CONF,
  })

  expect(calls).toEqual(['publish:t1'])
  expect(shown).toEqual(['t1'])
})
