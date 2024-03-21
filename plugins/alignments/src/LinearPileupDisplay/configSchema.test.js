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
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          name: 'SvgFeatureRenderer',
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
    displayId: 'display0',
    name: 'Zonker Display',
    type: 'LinearPileupDisplay',
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
    displayId: 'display0',
    name: 'Zonker Display',
    type: 'LinearPileupDisplay',
  }

  const model = modelFactory(configSchema)
  const nm = model.create(config)

  expect(nm.jexlFilters).toEqual([])
  const filter = [`jexl:get(feature,'end')==${99319638}`]
  nm.setJexlFilters(filter)
  expect(nm.jexlFilters).toEqual([`jexl:get(feature,'end')==${99319638}`])
})
