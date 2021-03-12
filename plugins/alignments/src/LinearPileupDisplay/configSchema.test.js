import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import {
  svgFeatureRendererConfigSchema,
  SvgFeatureRendererReactComponent,
} from '@jbrowse/plugin-svg'
import PileupRenderer, {
  configSchema as pileupRendererConfigSchema,
  ReactComponent as PileupRendererReactComponent,
} from '../PileupRenderer'
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})

class PileupRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new PileupRenderer({
          name: 'PileupRenderer',
          ReactComponent: PileupRendererReactComponent,
          configSchema: pileupRendererConfigSchema,
          pluginManager,
        }),
    )
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
