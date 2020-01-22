import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import SNPXYRenderer, {
  configSchema as snpXYRendererConfigSchema,
  ReactComponent as SNPXYRendererReactComponent,
} from '../SNPXYRenderer' // change renderer
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})
// change renderer
class SNPXYRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new SNPXYRenderer({
          name: 'SNPXYRenderer',
          ReactComponent: SNPXYRendererReactComponent,
          configSchema: snpXYRendererConfigSchema,
        }),
    )
  }
}

test('has a viewType attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([new SNPXYRendererPlugin()]).configure(),
  )
  const config = configSchema.create({
    type: 'SNPTrack',
    trackId: 'track1',
    name: 'SNPZonker Track',
  })
  expect(config.viewType).toEqual('LinearGenomeView')
})
