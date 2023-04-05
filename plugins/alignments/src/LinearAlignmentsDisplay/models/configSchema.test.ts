import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import {
  svgFeatureRendererConfigSchema,
  SvgFeatureRendererReactComponent,
} from '@jbrowse/plugin-svg'

// locals
import PileupRenderer from '../../PileupRenderer'
import SNPCoverageRenderer from '../../SNPCoverageRenderer'
import LinearPileupDisplay from '../../LinearPileupDisplay'
import LinearSNPCoverageDisplay from '../../LinearSNPCoverageDisplay'
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // @ts-expect-error
  console.warn.mockRestore()
})

class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'
  install(pluginManager: PluginManager) {
    PileupRenderer(pluginManager)

    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          pluginManager,
        }),
    )

    SNPCoverageRenderer(pluginManager)
    LinearPileupDisplay(pluginManager)
    LinearSNPCoverageDisplay(pluginManager)
  }
}

test('has a type attr', () => {
  const configSchema = configSchemaFactory(
    new PluginManager([new AlignmentsPlugin()])
      .createPluggableElements()
      .configure(),
  )
  const config = configSchema.create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'display0',
    name: 'Zonker Display',
  })

  expect(config.type).toEqual('LinearAlignmentsDisplay')
})
