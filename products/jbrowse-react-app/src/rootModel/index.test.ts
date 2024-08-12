// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import rootModelFactory from './'
import sessionModelFactory from '../sessionModel'

jest.mock('../makeWorkerInstance', () => () => {})

function getRootModel() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return rootModelFactory({ pluginManager, sessionModelFactory })
}
describe('Root MST model', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('creates with defaults', () => {
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    expect(root.session).toBeUndefined()
    root.setDefaultSession()
    expect(root.session).toBeTruthy()
    expect(root.jbrowse.assemblies.length).toBe(0)
    expect(getSnapshot(root.jbrowse.configuration)).toMatchSnapshot()
  })

  it('creates with a minimal session', () => {
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      session: { name: 'testSession' },
    })
    expect(root.session).toBeTruthy()
  })

  it('activates a session snapshot', () => {
    const session = { name: 'testSession' }
    localStorage.setItem('localSaved-123', JSON.stringify({ session }))
    Storage.prototype.getItem = jest.fn(
      () => `{"session": {"name": "testSession"}}`,
    )
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    expect(root.session).toBeUndefined()
    root.setSession(session)
    expect(root.session).toBeTruthy()
  })

  it('adds track and connection configs to an assembly', () => {
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
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
    expect(getSnapshot(newTrackConf)).toMatchSnapshot()
    expect(root.jbrowse.tracks.length).toBe(1)
    const newConnectionConf = root.jbrowse.addConnectionConf({
      type: 'JBrowse1Connection',
      connectionId: 'connectionId0',
    })
    expect(getSnapshot(newConnectionConf)).toMatchSnapshot()
    expect(root.jbrowse.connections.length).toBe(1)
  })

  it('throws if session is invalid', () => {
    expect(() =>
      getRootModel().create({
        jbrowse: {
          configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        },
        session: {},
      }),
    ).toThrow()
  })

  it('throws if session snapshot is invalid', () => {
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    expect(() => {
      root.setSession({})
    }).toThrow()
  })

  it('adds menus', () => {
    const root = getRootModel().create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    expect(root.menus).toMatchSnapshot()
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
    expect(root.menus).toMatchSnapshot()
    expect(() => {
      root.appendToSubMenu(['Second Menu', 'First Menu Item'], {
        label: 'First Sub Menu Item',
        onClick: () => {},
      })
    }).toThrow(/is not a subMenu/)
  })
})
