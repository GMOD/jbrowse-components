import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import { createTestSession } from '../rootModel'
import sessionModelFactory from '.'
jest.mock('../makeWorkerInstance', () => () => {})

describe('JBrowseWebSessionModel', () => {
  it('creates with no parent and just a name', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory({ pluginManager })
    const session = sessionModel.create(
      { name: 'testSession' },
      { pluginManager },
    )

    const { id, ...rest } = getSnapshot(session)
    expect(rest).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ drawerWidth: 256 })
    expect(session.drawerWidth).toBe(256)
  })
})