// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import { resolveMenus } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

function getRootModel() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return rootModelFactory({
    pluginManager,
    sessionModelFactory,
  })
}
afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const mainThreadConfig = {
  jbrowse: {
    configuration: {
      rpc: {
        defaultDriver: 'MainThreadRpcDriver',
      },
    },
  },
}

test('creates with defaults', () => {
  const root = getRootModel().create(mainThreadConfig)
  expect(root.session).toBeUndefined()
  root.setDefaultSession()
  expect(root.session).toBeTruthy()
  expect(root.jbrowse.assemblies.length).toBe(0)
  expect(getSnapshot(root.jbrowse.configuration)).toMatchSnapshot()
})

test('creates with a minimal session', () => {
  const root = getRootModel().create({
    ...mainThreadConfig,
    session: {
      name: 'testSession',
    },
  })
  expect(root.session).toBeTruthy()
})

// no localStorage setup: this used to seed a `localSaved-123` key and replace
// Storage.prototype.getItem outright, neither of which setSession reads — and
// the replacement was never restored, so every test after it in this file ran
// with a getItem that returned the same session snapshot for any key.
test('activates a session snapshot', () => {
  const session = { name: 'testSession' }
  const root = getRootModel().create(mainThreadConfig)
  expect(root.session).toBeUndefined()
  root.setSession(session)
  expect(root.session).toBeTruthy()
})

test('adds track and connection configs to an assembly', () => {
  const root = getRootModel().create({
    jbrowse: {
      ...mainThreadConfig.jbrowse,
      assemblies: [
        {
          name: 'assembly1',
          aliases: ['assemblyA'],
          sequence: {
            trackId: 'sequenceConfigId',
            type: 'ReferenceSequenceTrack',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              adapterId: 'sequenceConfigAdapterId',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 10,
                  seq: 'cattgttgcg',
                },
              ],
            },
          },
        },
      ],
    },
  })
  expect(root.jbrowse.assemblies.length).toBe(1)
  expect(getSnapshot(root.jbrowse.assemblies[0])).toMatchSnapshot()
  const newTrackConf = root.jbrowse.addTrackConf({
    type: 'FeatureTrack',
    trackId: 'trackId0',
  })
  expect(newTrackConf).toMatchSnapshot()
  expect(root.jbrowse.tracks.length).toBe(1)
  const newConnectionConf = root.jbrowse.addConnectionConf({
    type: 'JBrowse1Connection',
    connectionId: 'connectionId0',
  })
  expect(getSnapshot(newConnectionConf)).toMatchSnapshot()
  expect(root.jbrowse.connections.length).toBe(1)
})

describe('getTrackById hydration', () => {
  function makeRoot() {
    const root = getRootModel().create({
      ...mainThreadConfig,
      jbrowse: {
        ...mainThreadConfig.jbrowse,
        tracks: [
          { type: 'FeatureTrack', trackId: 'frozenTrack1', name: 'first' },
          { type: 'FeatureTrack', trackId: 'frozenTrack2', name: 'second' },
        ],
      },
      session: { name: 'testSession' },
    })
    return root
  }

  test('returns the same MST instance across reads', () => {
    const session = makeRoot().session!
    const first = session.getTrackById('frozenTrack1')
    const second = session.getTrackById('frozenTrack1')
    expect(first).toBe(second)
    expect(readConfObject(first, 'name')).toBe('first')
  })

  test('yields a new instance after updateTrackConf replaces the frozen entry', () => {
    const root = makeRoot()
    const session = root.session!
    const before = session.getTrackById('frozenTrack1')
    root.jbrowse.updateTrackConf({
      type: 'FeatureTrack',
      trackId: 'frozenTrack1',
      name: 'renamed',
    })
    const after = session.getTrackById('frozenTrack1')
    expect(after).not.toBe(before)
    expect(readConfObject(after, 'name')).toBe('renamed')
  })

  test('unchanged entries keep identity when a sibling is edited', () => {
    const root = makeRoot()
    const session = root.session!
    const track2Before = session.getTrackById('frozenTrack2')
    root.jbrowse.updateTrackConf({
      type: 'FeatureTrack',
      trackId: 'frozenTrack1',
      name: 'renamed',
    })
    const track2After = session.getTrackById('frozenTrack2')
    expect(track2After).toBe(track2Before)
  })
})

describe('connection track persistence', () => {
  // hydrateConnection (below) replays connect() on a config with no
  // assemblyNames; connect() catches the resulting error and reports it via
  // session.notifyError, but also console.errors it along the way. The
  // rejection resolves asynchronously (after a dynamic import), possibly
  // after the test body returns, so the spy stays installed for the whole
  // describe block rather than a single test.
  let consoleError: jest.SpyInstance
  beforeAll(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterAll(() => {
    consoleError.mockRestore()
  })

  const assembly = {
    name: 'assembly1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        adapterId: 'sequenceConfigAdapterId',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  }

  // pass tracks in the connection's initialSnapshot so BaseConnectionModel's
  // afterAttach skips connect() — no network needed to simulate a live hub
  function makeRootWithConnection() {
    const root = getRootModel().create({
      ...mainThreadConfig,
      jbrowse: { ...mainThreadConfig.jbrowse, assemblies: [assembly] },
      session: { name: 'testSession' },
    })
    const session = root.session!
    const connConf = session.addConnectionConf({
      type: 'JBrowse1Connection',
      connectionId: 'conn1',
      name: 'Conn 1',
    })
    session.makeConnection(connConf, {
      tracks: [
        { type: 'FeatureTrack', trackId: 'connTrack1', name: 'Conn Track 1' },
      ],
    })
    return root
  }

  test('capturing an opened connection track persists it with provenance', () => {
    const session = makeRootWithConnection().session!
    session.captureConnectionTrack('connTrack1')
    expect(session.connectionTrackConfigs.connTrack1?.connectionId).toBe(
      'conn1',
    )
  })

  test('snapshot strips connection instances but keeps captured tracks', () => {
    const session = makeRootWithConnection().session!
    session.captureConnectionTrack('connTrack1')
    const snap: {
      connectionInstances?: unknown
      connectionTrackConfigs?: Record<string, unknown>
    } = JSON.parse(JSON.stringify(getSnapshot(session)))
    expect(snap.connectionInstances).toBeUndefined()
    expect(snap.connectionTrackConfigs?.connTrack1).toBeTruthy()
  })

  test('captured track resolves after reload without the connection', () => {
    const session = makeRootWithConnection().session!
    session.captureConnectionTrack('connTrack1')
    const snap = JSON.parse(JSON.stringify(getSnapshot(session)))

    const root2 = getRootModel().create({
      ...mainThreadConfig,
      jbrowse: { ...mainThreadConfig.jbrowse, assemblies: [assembly] },
    })
    root2.setSession(snap)
    const session2 = root2.session!
    expect(session2.connectionInstances.length).toBe(0)
    const resolved = session2.getTrackById('connTrack1')
    expect(readConfObject(resolved, 'name')).toBe('Conn Track 1')
  })

  test('editing a connection track persists into connectionTrackConfigs', () => {
    const session = makeRootWithConnection().session!
    session.captureConnectionTrack('connTrack1')
    session.updateTrackConfiguration({
      type: 'FeatureTrack',
      trackId: 'connTrack1',
      name: 'Edited Name',
    })
    expect(session.connectionTrackConfigs.connTrack1?.config.name).toBe(
      'Edited Name',
    )
  })

  test('pruning drops an unreferenced connection track config', () => {
    const session = makeRootWithConnection().session!
    session.captureConnectionTrack('connTrack1')
    expect(session.connectionTrackConfigs.connTrack1).toBeTruthy()
    session.pruneConnectionTrackConfig('connTrack1')
    expect(session.connectionTrackConfigs.connTrack1).toBeUndefined()
  })

  test('a user-made connection is not marked silent', () => {
    const session = makeRootWithConnection().session!
    const conn = session.connectionInstances.find(
      (c: { connectionId: string }) => c.connectionId === 'conn1',
    )
    expect(conn?.silent).toBe(false)
  })

  test('hydrateConnection is a no-op when already live', () => {
    const session = makeRootWithConnection().session!
    expect(session.connectionInstances.length).toBe(1)
    session.hydrateConnection('conn1')
    expect(session.connectionInstances.length).toBe(1)
  })

  test('hydrateConnection silently re-establishes a dormant connection', () => {
    const session = makeRootWithConnection().session!
    const conf = session.connections.find(
      (c: { connectionId: string }) => c.connectionId === 'conn1',
    )!
    session.breakConnection(conf)
    expect(session.connectionInstances.length).toBe(0)

    session.hydrateConnection('conn1')
    const conn = session.connectionInstances.find(
      (c: { connectionId: string }) => c.connectionId === 'conn1',
    )
    expect(conn?.silent).toBe(true)
  })
})

test('throws if session is invalid', () => {
  expect(() => {
    getRootModel().create({
      ...mainThreadConfig,
      session: {},
    })
  }).toThrow()
})

test('throws if session snapshot is invalid', () => {
  const root = getRootModel().create(mainThreadConfig)
  expect(() => {
    root.setSession({})
  }).toThrow()
})

test('adds menus', () => {
  const root = getRootModel().create(mainThreadConfig)
  expect(resolveMenus(root.menus())).toMatchSnapshot()
  root.appendMenu('Third Menu')
  root.insertMenu('Second Menu', -1)
  root.appendToMenu('Second Menu', {
    label: 'Second Menu Item',
    onClick: () => {},
  })
  root.insertInMenu(
    'Second Menu',
    {
      label: 'First Menu Item',
      onClick: () => {},
    },
    -1,
  )
  root.appendToSubMenu(['Second Menu', 'First Sub Menu'], {
    label: 'Second Sub Menu Item',
    onClick: () => {},
  })
  root.insertInSubMenu(
    ['Second Menu', 'First Sub Menu'],
    {
      label: 'First Sub Menu Item',
      onClick: () => {},
    },
    -1,
  )
  expect(resolveMenus(root.menus())).toMatchSnapshot()
})

describe('upsertSessionMetadata', () => {
  const meta = (id: string, updatedAt: Date, configPath = '') => ({
    id,
    name: id,
    createdAt: new Date(0),
    updatedAt,
    configPath,
    favorite: false,
  })

  test('moves the rewritten row to the top without re-reading the store', () => {
    const root = getRootModel().create(mainThreadConfig)
    const older = meta('older', new Date(1000))
    const newer = meta('newer', new Date(2000))
    root.setSavedSessionMetadata([newer, older])

    root.upsertSessionMetadata(meta('older', new Date(3000)))

    expect(root.savedSessionMetadata?.map(m => m.id)).toEqual([
      'older',
      'newer',
    ])
    // replaced, not appended alongside the row it supersedes
    expect(root.savedSessionMetadata).toHaveLength(2)
  })

  test('adds a row the list has not seen yet', () => {
    const root = getRootModel().create(mainThreadConfig)
    root.setSavedSessionMetadata([meta('existing', new Date(1000))])

    root.upsertSessionMetadata(meta('fresh', new Date(2000)))

    expect(root.savedSessionMetadata?.map(m => m.id)).toEqual([
      'fresh',
      'existing',
    ])
  })

  test('ignores a row belonging to another config', () => {
    const root = getRootModel().create(mainThreadConfig)
    const existing = meta('existing', new Date(1000))
    root.setSavedSessionMetadata([existing])

    root.upsertSessionMetadata(meta('other', new Date(2000), 'other.json'))

    expect(root.savedSessionMetadata).toEqual([existing])
  })
})

describe('deleteSavedSession', () => {
  test('refuses to delete the open session rather than letting it come back', async () => {
    const root = getRootModel().create(mainThreadConfig)
    root.setSession({ name: 'testSession' })
    const session = root.session!

    // the autosave autorun rewrites the open session's rows every 400ms, so a
    // delete would only make it vanish until the next edit — and lose its
    // favorite flag, which lives in the row deleted
    await root.deleteSavedSession(session.id)

    expect(
      session.snackbarMessages.map((m: { message: string }) => m.message),
    ).toEqual(['Cannot delete the session that is currently open'])
  })
})

describe('deleteSavedSessions', () => {
  // a bulk delete is not aimed at any one row, so the open session is dropped
  // from the batch silently rather than reported on -- but it must still be
  // dropped, or the batch would delete it and lose its star
  test('skips the open session without a snackbar', async () => {
    const root = getRootModel().create(mainThreadConfig)
    root.setSession({ name: 'testSession' })
    const session = root.session!

    await root.deleteSavedSessions([session.id])

    expect(session.snackbarMessages).toHaveLength(0)
  })

  // deleting nothing must not open a transaction, so that a "delete old
  // sessions" run that matches nothing is genuinely a no-op
  test('does nothing when the batch is empty', async () => {
    const root = getRootModel().create(mainThreadConfig)
    root.setSession({ name: 'testSession' })

    await expect(root.deleteSavedSessions([])).resolves.toBeUndefined()
  })
})

// A desktop "export to web" carries the drawer as the sender left it, and
// desktop registers widgets web does not (blat's UcscResultsWidget, left behind
// by every BLAT / in-silico PCR search). `widgets` is a bare union with no
// dispatcher, so one entry web cannot build used to throw out of `cast` — past
// the filter that handles unloadable tracks — and cost the recipient the whole
// session, under a message telling them to ask for a Share link they had
// already been sent.
test('keeps a session whose drawer holds a widget this build has no plugin for', () => {
  const root = getRootModel().create(mainThreadConfig)
  root.setSession({
    name: 'from desktop',
    widgets: {
      ucscResults: {
        id: 'ucscResults',
        type: 'UcscResultsWidget',
        features: [],
      },
      hierarchicalTrackSelector: {
        id: 'hierarchicalTrackSelector',
        type: 'HierarchicalTrackSelectorWidget',
      },
    },
    activeWidgets: { ucscResults: 'ucscResults' },
  })
  const session = root.session!
  expect(session.name).toBe('from desktop')
  expect([...session.widgets.keys()]).toEqual(['hierarchicalTrackSelector'])
  expect([...session.activeWidgets.keys()]).toEqual([])
  // and the recipient is told which plugin they are missing
  expect(session.snackbarMessages.at(-1)?.message).toContain(
    'UcscResultsWidget',
  )
})

// A synteny view keeps its tracks under `levels[].tracks`, two containers below
// `session.views` — so a prune that read `view.tracks` and `view.views` found
// nothing to do, the union short-circuited on the registered VIEW name, and the
// unbuildable track went straight into `cast`. The whole session was lost on one
// of the two routes this module exists to keep open.
test('keeps a synteny session whose level holds a track this build cannot make', () => {
  const root = getRootModel().create(mainThreadConfig)
  root.setSession({
    name: 'from a colleague',
    views: [
      {
        id: 'syn',
        type: 'LinearSyntenyView',
        views: [
          { id: 'row0', type: 'LinearGenomeView' },
          { id: 'row1', type: 'LinearGenomeView' },
        ],
        levels: [
          {
            id: 'level0',
            level: 0,
            tracks: [{ id: 'imagined', type: 'ImaginarySyntenyTrack' }],
          },
        ],
      },
    ],
  })
  const session = root.session!
  expect(session.views.map((v: { id: string }) => v.id)).toEqual(['syn'])
  expect(session.views[0].levels[0].tracks.length).toBe(0)
  expect(session.snackbarMessages.at(-1)?.message).toContain(
    'ImaginarySyntenyTrack',
  )
  // and the level, not the view, is the anchor it comes back to
  const snap = getSnapshot(session) as Record<string, unknown>
  expect(snap.heldForMissingPlugins).toEqual([
    {
      group: 'track',
      parent: 'level0',
      index: 0,
      snapshot: { id: 'imagined', type: 'ImaginarySyntenyTrack' },
    },
  ])
})
