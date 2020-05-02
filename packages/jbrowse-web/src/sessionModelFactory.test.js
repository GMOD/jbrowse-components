import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import { createTestSession } from './rootModel'
import sessionModelFactory from './sessionModelFactory'

describe('JBrowseWebSessionModel', () => {
  it('creates with no parent and just a name', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory(pluginManager)
    const session = sessionModel.create({ name: 'testSession' })
    expect(getSnapshot(session)).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ drawerWidth: 256 })
    //@ts-ignore
    expect(session.drawerWidth).toBe(256)
  })
})
