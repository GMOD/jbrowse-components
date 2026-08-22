// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import { resolveMenus } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import sessionModelFactory from '../sessionModel/index.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance', () => () => {})

function getRootModel(makeWorkerInstance?: () => Worker) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return rootModelFactory({
    pluginManager,
    sessionModelFactory,
    makeWorkerInstance,
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

// the RpcManager is built by product-core's base root from the options this
// factory hands it, so the worker-factory-implies-worker-driver rule has to
// survive that hop — a host that passes no factory must stay on the main thread
describe('the default RPC driver follows makeWorkerInstance', () => {
  test('main thread with no worker factory', () => {
    const root = getRootModel().create(
      // no rpc.defaultDriver here: the point is what the *host* default is
      { jbrowse: {} },
    )
    expect(root.rpcManager.driverName).toBe('MainThreadRpcDriver')
  })

  test('web worker with one', () => {
    const root = getRootModel(() => ({}) as Worker).create({ jbrowse: {} })
    expect(root.rpcManager.driverName).toBe('WebWorkerRpcDriver')
  })
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

// An embedded component cannot rebuild its own plugin manager: it never fetches
// plugins (loadPlugins is the host's call) and it doesn't own the React tree it
// is mounted into. It used to answer a plugin change with
// window.location.reload(), which reloads the *host's* page and, with no
// autosave behind it, loses the session outright.
describe('a plugin-set change', () => {
  const pluginDef = { name: 'Some', url: 'https://example.com/some.umd.js' }

  test('hands the host what it needs to rebuild, exactly once', () => {
    const root = getRootModel().create({
      jbrowse: { ...mainThreadConfig.jbrowse, plugins: [pluginDef] },
      session: { name: 'my session' },
    })
    const onPluginsUpdated = jest.fn()
    root.setPluginsUpdatedCallback(onPluginsUpdated)

    root.setPluginsUpdated()

    expect(onPluginsUpdated).toHaveBeenCalledTimes(1)
    const [update] = onPluginsUpdated.mock.calls[0]!
    // the plugins to loadPlugins, and the session to hand back so the user
    // lands where they were
    expect(update.plugins).toEqual([pluginDef])
    expect(update.session.name).toBe('my session')

    // pluginsUpdated latches true and the root lives on, so a later session
    // edit must not ask the host to rebuild a second time
    root.session!.setName('renamed')
    expect(onPluginsUpdated).toHaveBeenCalledTimes(1)
  })

  test('tells the user when the host has no hook, instead of reloading', () => {
    const root = getRootModel().create({
      ...mainThreadConfig,
      session: { name: 'my session' },
    })
    const notify = jest.spyOn(root.session, 'notify')

    root.setPluginsUpdated()

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('take effect'),
      'info',
    )
  })
})
