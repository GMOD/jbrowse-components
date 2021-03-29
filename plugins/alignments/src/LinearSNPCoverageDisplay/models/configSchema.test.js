import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import SNPCoverageRenderer, {
  configSchema as snpCoverageRendererConfigSchema,
  ReactComponent as SNPCoverageRendererReactComponent,
} from '../../SNPCoverageRenderer' // change renderer
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})
// change renderer
class SNPCoverageRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new SNPCoverageRenderer({
          name: 'SNPCoverageRenderer',
          ReactComponent: SNPCoverageRendererReactComponent,
          configSchema: snpCoverageRendererConfigSchema,
          pluginManager,
        }),
    )
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
