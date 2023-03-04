import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import SNPCoverageRenderer from '../../SNPCoverageRenderer' // change renderer
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // @ts-expect-error
  console.warn.mockRestore()
})
// change renderer
class SNPCoverageRendererPlugin extends Plugin {
  name = 'SNPCoverageRendererPlugin'
  install(pluginManager: PluginManager) {
    SNPCoverageRenderer(pluginManager)
  }
}

test('has a type attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([new SNPCoverageRendererPlugin()])
      .createPluggableElements()
      .configure(),
  )
  const config = configSchema.create({
    type: 'LinearSNPCoverageDisplay',
    displayId: 'display1',
    name: 'SNPZonker Display',
  })
  expect(config.type).toEqual('LinearSNPCoverageDisplay')
})
