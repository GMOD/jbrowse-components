// Desktop composes `TracksManagerSessionMixin`, not the session-tracks one, so
// it has no `sessionTracks` array — and until the destination split it had no
// `addSessionTrackConf` either. Every feature that had moved onto that action
// therefore went dark HERE and nowhere else: the guard
// `isSessionWithAddSessionTrack` simply read false, so the spreadsheet view's
// imported callset track and the derivative-allele reconstruction's segment
// labels were skipped, silently and only on desktop.
//
// So the mixin defines it too, landing in the config — which on desktop is the
// one user's own file, saved alongside the session, rather than something a
// server hands other visitors. A test rather than a comment because the failure
// is a guard going false, which throws nothing and shows up as a missing track.
import PluginManager from '@jbrowse/core/PluginManager'
import { isSessionWithAddSessionTrack } from '@jbrowse/core/util'

import corePlugins from '../corePlugins.ts'
import rootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel.ts'

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

function createSession() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    },
    { pluginManager },
  )
  root.setSession({ name: 'test' })
  return root.session!
}

const CONF = {
  trackId: 'derivative-segments-1',
  type: 'FeatureTrack',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
}

test('a desktop session answers the session-scoped guard', () => {
  expect(isSessionWithAddSessionTrack(createSession())).toBe(true)
})

test('addSessionTrackConf lands the track where desktop keeps tracks', () => {
  const session = createSession()

  session.addSessionTrackConf(CONF)

  expect(session.tracks.map((t: { trackId: string }) => t.trackId)).toContain(
    'derivative-segments-1',
  )
})

// desktop's destination is the config, whose own adder appends without
// looking — so a re-add used to leave two entries under one id, the first
// winning. Same content answers the existing one; different content is refused.
test('re-adding under a known trackId neither duplicates nor silently keeps the old one', () => {
  const session = createSession()
  session.addSessionTrackConf(CONF)
  session.addSessionTrackConf(CONF)
  expect(
    session.tracks.filter(
      (t: { trackId: string }) => t.trackId === 'derivative-segments-1',
    ),
  ).toHaveLength(1)
  expect(() =>
    session.addSessionTrackConf({
      ...CONF,
      adapter: {
        type: 'FromConfigAdapter',
        features: [{ uniqueId: 'a', refName: 'ctgA', start: 1, end: 2 }],
      },
    }),
  ).toThrow(/already in this session with a different configuration/)
})

test('the deprecated addTrackConf alias dedupes the same way', () => {
  const session = createSession()
  session.addSessionTrackConf(CONF)
  expect(session.addTrackConf(CONF)).toBe(
    session.getTrackById('derivative-segments-1'),
  )
  expect(
    session.tracks.filter(
      (t: { trackId: string }) => t.trackId === 'derivative-segments-1',
    ),
  ).toHaveLength(1)
})
