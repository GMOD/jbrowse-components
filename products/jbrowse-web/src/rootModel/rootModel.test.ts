// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
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

test('activates a session snapshot', () => {
  const session = { name: 'testSession' }
  localStorage.setItem('localSaved-123', JSON.stringify({ session }))
  Storage.prototype.getItem = jest.fn(
    () => `{"session": {"name": "testSession"}}`,
  )

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
  expect(root.menus()).toMatchSnapshot()
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
  expect(root.menus()).toMatchSnapshot()
})
