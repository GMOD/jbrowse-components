import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import SNPCoverageRenderer, {
  configSchema as snpCoverageRendererConfigSchema,
  ReactComponent as SNPCoverageRendererReactComponent,
} from '../SNPCoverageRenderer' // change renderer
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
        }),
    )
  }
}

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([new SNPCoverageRendererPlugin()]).configure(),
  )
  const config = configSchema.create({
    type: 'SNPCoverageTrack',
    trackId: 'track1',
    name: 'SNPZonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
