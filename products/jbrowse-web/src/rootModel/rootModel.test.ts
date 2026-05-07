// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import rootModelFactory from './rootModel.ts'
import sessionModelFactory from '../sessionModel/index.ts'

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

describe('tracksById hydration', () => {
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
    const first = session.tracksById.frozenTrack1
    const second = session.tracksById.frozenTrack1
    expect(first).toBe(second)
    expect(readConfObject(first, 'name')).toBe('first')
  })

  test('yields a new instance after updateTrackConf replaces the frozen entry', () => {
    const root = makeRoot()
    const session = root.session!
    const before = session.tracksById.frozenTrack1
    root.jbrowse.updateTrackConf({
      type: 'FeatureTrack',
      trackId: 'frozenTrack1',
      name: 'renamed',
    })
    const after = session.tracksById.frozenTrack1
    expect(after).not.toBe(before)
    expect(readConfObject(after, 'name')).toBe('renamed')
  })

  test('unchanged entries keep identity when a sibling is edited', () => {
    const root = makeRoot()
    const session = root.session!
    const track2Before = session.tracksById.frozenTrack2
    root.jbrowse.updateTrackConf({
      type: 'FeatureTrack',
      trackId: 'frozenTrack1',
      name: 'renamed',
    })
    const track2After = session.tracksById.frozenTrack2
    expect(track2After).toBe(track2Before)
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
