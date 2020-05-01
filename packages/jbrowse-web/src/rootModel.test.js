import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import corePlugins from './corePlugins'
import rootModelFactory from './rootModel'

describe('Root MST model', () => {
  let rootModel

  beforeAll(() => {
    const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    pluginManager.createPluggableElements()
    pluginManager.configure()
    rootModel = rootModelFactory(pluginManager)
  })

  it('creates with defaults', () => {
    const root = rootModel.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    expect(root.session).toBeUndefined()
    expect(root.jbrowse.savedSessions.length).toBe(0)
    root.setDefaultSession()
    expect(root.session).toBeTruthy()
    expect(root.jbrowse.savedSessions.length).toBe(1)
    expect(root.jbrowse.assemblies.length).toBe(0)
    expect(getSnapshot(root.jbrowse.configuration)).toMatchSnapshot()
  })

  it('creates with a minimal session', () => {
    const root = rootModel.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      session: { name: 'testSession' },
    })
    expect(root.session).toBeTruthy()
  })

  it('activates a session snapshot', () => {
    const root = rootModel.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        savedSessions: [{ name: 'testSession' }],
      },
    })
    expect(root.session).toBeUndefined()
    root.setSession(root.jbrowse.savedSessions[0])
    expect(root.session).toBeTruthy()
  })

  it('adds track and connection configs to an assembly', () => {
    const root = rootModel.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        assemblies: [{ name: 'assembly1', aliases: ['assemblyA'] }],
      },
    })
    expect(root.jbrowse.assemblies.length).toBe(1)
    expect(getSnapshot(root.jbrowse.assemblies[0])).toMatchSnapshot()
    const newTrackConf = root.jbrowse.addTrackConf({
      type: 'BasicTrack',
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

  it('adds a session snapshot', () => {
    const root = rootModel.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
    })
    root.jbrowse.addSavedSession({ name: 'testSession' })
    expect(root.jbrowse.savedSessions.length).toBe(1)
  })

  it('throws if session is invalid', () => {
    expect(() =>
      // @ts-ignore expects an error here
      rootModel.create({
        jbrowse: {
          configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        },
        session: {},
      }),
    ).toThrow()
  })

  it('throws if session snapshot is invalid', () => {
    expect(() =>
      // @ts-ignore expects an error here
      rootModel.create({
        jbrowse: {
          configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
          savedSessions: [{}],
        },
      }),
    ).toThrow()
  })

  it('adds menus', () => {
    const root = rootModel.create({
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
