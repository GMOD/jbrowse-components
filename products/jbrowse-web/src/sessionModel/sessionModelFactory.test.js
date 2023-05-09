// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import { configure } from 'mobx'
import { createTestSession } from '../rootModel'
import sessionModelFactory from '.'
jest.mock('../makeWorkerInstance', () => () => {})

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  configure({ computedConfigurable: true }) // so jest.spyOn works for MST get
})

afterEach(() => {
  console.warn.mockRestore()
})

describe('JBrowseWebSessionModel', () => {
  it('creates with no parent and just a name', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory(pluginManager)
    const session = sessionModel.create(
      { name: 'testSession' },
      { pluginManager },
    )

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = getSnapshot(session)
    expect(rest).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ drawerWidth: 256 })
    expect(session.drawerWidth).toBe(256)
  })

  xit('adds connection to session connections', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory(pluginManager)
    const session = sessionModel.create(
      { name: 'testSession' },
      { pluginManager },
    )

    jest
      .spyOn(session, 'adminMode', 'get')
      .mockImplementationOnce(() => {})
      .mockReturnValueOnce(false)

    session.addConnectionConf({
      assemblyName: 'test1',
      connectionId: 'TestConnection-test1-1',
      hubTxtLocation: {
        uri: 'https://example.com',
        locationType: 'UriLocation',
      },
      type: 'JBrowse1Connection',
    })

    expect(session.sessionConnections.length).toBe(1)
  })
})
