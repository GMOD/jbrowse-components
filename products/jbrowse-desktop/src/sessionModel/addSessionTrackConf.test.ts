// Until the destination split desktop had no `addSessionTrackConf`, so every
// feature that had moved onto that action went dark HERE and nowhere else: the
// guard `isSessionWithAddSessionTrack` simply read false, and the spreadsheet
// view's imported callset track was skipped, silently and only on desktop. A
// test rather than a comment because the failure is a guard going false, which
// throws nothing and shows up as a missing track.
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

// A re-add used to leave two entries under one id, the first winning. Same
// content answers the existing one; different content is refused.
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

// Desktop edits a track the way every session does, as a delta over the file's
// own config, so undo and "Reset track settings" reach it.
test('a desktop track edit is a delta that Reset discards', () => {
  const session = createSession()
  session.jbrowse.addTrackConf(CONF)
  const base = session.jbrowse.tracks.find(
    (t: { trackId: string }) => t.trackId === CONF.trackId,
  )

  session.updateTrackConfiguration({ ...CONF, name: 'Edited name' })

  expect(session.trackConfigDeltas[CONF.trackId]).toBeDefined()
  expect(session.isTrackOverride(CONF.trackId)).toBe(true)
  expect(
    session.jbrowse.tracks.find(
      (t: { trackId: string }) => t.trackId === CONF.trackId,
    ),
  ).toBe(base)

  session.resetTrackConfiguration(CONF.trackId)
  expect(session.trackConfigDeltas[CONF.trackId]).toBeUndefined()
})
