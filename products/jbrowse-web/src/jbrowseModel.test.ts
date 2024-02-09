import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import assemblyConfigSchemasFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import configSnapshot from '../test_data/volvox/config.json'
import corePlugins from './corePlugins'
import jbrowseModelFactory from './jbrowseModel'

type JBrowseModelType = ReturnType<typeof jbrowseModelFactory>

describe('JBrowse model', () => {
  let JBrowseModel: JBrowseModelType
  beforeAll(() => {
    const pluginManager = new PluginManager(corePlugins.map(P => new P()))
      .createPluggableElements()
      .configure()

    JBrowseModel = jbrowseModelFactory({
      adminMode: false,
      pluginManager,
      assemblyConfigSchema: assemblyConfigSchemasFactory(pluginManager),
    })
  })

  it('creates with empty snapshot', () => {
    const model = JBrowseModel.create({})
    expect(getSnapshot(model)).toMatchSnapshot()
  })

  it('creates with non-empty snapshot', () => {
    const model = JBrowseModel.create(configSnapshot)
    expect(getSnapshot(model)).toMatchSnapshot()
  })
})
