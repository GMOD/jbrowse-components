import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import SNPCoverageRenderer from '../../SNPCoverageRenderer' // change renderer
import configSchemaFactory from './configSchema'
import LinearSNPCoverageDisplay from '..'
import modelFactory from './model'

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
  install(pluginManager) {
    SNPCoverageRenderer(pluginManager)
  }
}
class LinearSNPCoverageDisplayPlugin extends Plugin {
  name = 'LinearSNPCoverageDisplayPlugin'
  install(pluginManager) {
    LinearSNPCoverageDisplay(pluginManager)
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

test('set custom jexl filters on linear snp cov display', async () => {
  const pm = new PluginManager([
    new SNPCoverageRendererPlugin(),
    new LinearSNPCoverageDisplayPlugin(),
  ])
    .createPluggableElements()
    .configure()
  const configSchema = configSchemaFactory(pm)

  const config = {
    type: 'LinearSNPCoverageDisplay',
    displayId: 'display1',
    name: 'SNPZonker Display',
  }

  const model = modelFactory(pm, configSchema)
  const nm = model.create(config)

  expect(nm.jexlFilters).toEqual([])
  const filter = [`jexl:get(feature,'end')==${99319638}`]
  nm.setJexlFilters(filter)
  expect(nm.jexlFilters).toEqual([`jexl:get(feature,'end')==${99319638}`])
})
