import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { getSnapshot, types } from 'mobx-state-tree'
import configSnapshot from '../test_data/volvox/config.json'
import AssemblyConfigSchemasFactory from './assemblyConfigSchemas'
import corePlugins from './corePlugins'
import jbrowseModelFactory from './jbrowseModel'
import sessionModelFactory from './sessionModelFactory'

type JBrowseModelType = ReturnType<typeof jbrowseModelFactory>

describe('JBrowse model', () => {
  let JBrowseModel: JBrowseModelType
  beforeAll(() => {
    const pluginManager = new PluginManager(corePlugins.map(P => new P()))
      .createPluggableElements()
      .configure()
    const Session = sessionModelFactory(pluginManager)
    const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
      pluginManager,
    )
    const assemblyConfigSchemasType = types.union(
      { dispatcher },
      ...assemblyConfigSchemas,
    )
    JBrowseModel = jbrowseModelFactory(
      pluginManager,
      Session,
      assemblyConfigSchemasType,
    )
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
