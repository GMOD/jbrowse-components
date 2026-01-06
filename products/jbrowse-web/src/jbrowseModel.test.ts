import PluginManager from '@jbrowse/core/PluginManager'
import assemblyConfigSchemasFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'
import jbrowseModelFactory from './jbrowseModel.ts'
import configSnapshot from '../test_data/volvox/config.json'

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
