import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, types } from 'mobx-state-tree'
import AssemblyConfigSchemasFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchemas'
import configSnapshot from '../test_data/volvox/config.json'
import corePlugins from './corePlugins'
import jbrowseModelFactory from './jbrowseModel'
import sessionModelFactory from './sessionModelFactory'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'

type JBrowseModelType = ReturnType<typeof jbrowseModelFactory>

describe('JBrowse model', () => {
  let JBrowseModel: JBrowseModelType
  beforeAll(() => {
    const pluginManager = new PluginManager(corePlugins.map(P => new P()))
      .createPluggableElements()
      .configure()

    const { assemblyConfigSchemas, dispatcher } =
      AssemblyConfigSchemasFactory(pluginManager)
    const assemblyConfigSchemasType = types.union(
      { dispatcher },
      ...assemblyConfigSchemas,
    )
    const Session = sessionModelFactory(
      pluginManager,
      assemblyConfigSchemasType,
    )
    JBrowseModel = jbrowseModelFactory(
      pluginManager,
      Session,
      assemblyConfigSchemasType as AnyConfigurationSchemaType,
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
