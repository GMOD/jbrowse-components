// import electron first, important, because the electron mock creates
// window.require
import 'electron'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import rootModelFactory, { DesktopRootModelType } from '.'
import sessionModelFactory from '../sessionModel'
jest.mock('../makeWorkerInstance', () => () => {})

describe('Root MST model', () => {
  let rootModel: DesktopRootModelType | undefined

  beforeAll(() => {
    const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    pluginManager.createPluggableElements()
    pluginManager.configure()
    rootModel = rootModelFactory(pluginManager, sessionModelFactory)
  })

  it('creates with defaults', () => {
    const root = rootModel!.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      assemblyManager: {},
    })
    expect(root.session).toBeUndefined()
    root.setDefaultSession()
    expect(root.session).toBeTruthy()
    expect(root.jbrowse.assemblies.length).toBe(0)
    expect(getSnapshot(root.jbrowse.configuration)).toMatchSnapshot()
  })

  it('adds menus', () => {
    const root = rootModel!.create({
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      assemblyManager: {},
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
