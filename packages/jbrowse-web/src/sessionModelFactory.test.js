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
    /** @type any */
    const session = createTestSession({ drawerWidth: 256 })
    expect(session.drawerWidth).toBe(256)
    expect(session.viewsWidth).toBe(1024)
  })

  it('shrinks a drawer width that is too big', () => {
    /** @type any */
    const session = createTestSession({ width: 1024, drawerWidth: 512 })
    session.updateWidth(512)
    expect(session.drawerWidth).toBe(256)
  })
})
