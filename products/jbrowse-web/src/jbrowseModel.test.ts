import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from 'mobx-state-tree'
import assemblyConfigSchemasFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import configSnapshot from '../test_data/volvox/config.json'
import corePlugins from './corePlugins'
import jbrowseModelFactory from './jbrowseModel'

function getModel() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()

  const assemblyConfigSchema = assemblyConfigSchemasFactory(pluginManager)
  return jbrowseModelFactory(pluginManager, assemblyConfigSchema, false)
}
describe('JBrowse model', () => {
  it('creates with empty snapshot', () => {
    const model = getModel().create({})
    expect(getSnapshot(model)).toMatchSnapshot()
  })

  it('creates with non-empty snapshot', () => {
    const model = getModel().create(configSnapshot)
    expect(getSnapshot(model)).toMatchSnapshot()
  })
})
