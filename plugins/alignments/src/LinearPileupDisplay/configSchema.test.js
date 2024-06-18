import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import {
  svgFeatureRendererConfigSchema,
  SvgFeatureRendererReactComponent,
} from '@jbrowse/plugin-svg'
import PileupRenderer from '../PileupRenderer'
import configSchemaFactory from './configSchema'
import modelFactory from './model'
import LinearPileupDisplay from '.'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})

class PileupRendererPlugin extends Plugin {
  install(pluginManager) {
    PileupRenderer(pluginManager)
  }
}

class LinearPileupDisplayPlugin extends Plugin {
  install(pluginManager) {
    LinearPileupDisplay(pluginManager)
  }
}

class SvgFeatureRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}

test('has a type attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([
      new PileupRendererPlugin(),
      new SvgFeatureRendererPlugin(),
    ])
      .createPluggableElements()
      .configure(),
  )
  const config = configSchema.create({
    type: 'LinearPileupDisplay',
    displayId: 'display0',
    name: 'Zonker Display',
  })
  expect(config.type).toEqual('LinearPileupDisplay')
})

test('set custom jexl filters on linear pileup display', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([
      new PileupRendererPlugin(),
      new SvgFeatureRendererPlugin(),
      new LinearPileupDisplayPlugin(),
    ])
      .createPluggableElements()
      .configure(),
  )

  const config = {
    type: 'LinearPileupDisplay',
    displayId: 'display0',
    name: 'Zonker Display',
  }

  const model = modelFactory(configSchema)
  const nm = model.create(config)

  expect(nm.jexlFilters).toEqual([])
  const filter = [`jexl:get(feature,'end')==${99319638}`]
  nm.setJexlFilters(filter)
  expect(nm.jexlFilters).toEqual([`jexl:get(feature,'end')==${99319638}`])
})
