import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import {
  svgFeatureRendererConfigSchema,
  SvgFeatureRendererReactComponent,
} from '@jbrowse/plugin-svg'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import PileupRenderer, {
  configSchema as pileupRendererConfigSchema,
  ReactComponent as PileupRendererReactComponent,
} from '../../PileupRenderer'
import SNPCoverageRenderer, {
  configSchema as snpCoverageRendererConfigSchema,
  ReactComponent as SNPCoverageRendererReactComponent,
} from '../../SNPCoverageRenderer'
import {
  configSchemaFactory as linearPileupDisplayConfigSchemaFactory,
  modelFactory as linearPileupDisplayModelFactory,
} from '../../LinearPileupDisplay'
import {
  configSchemaFactory as linearSNPCoverageDisplayConfigSchemaFactory,
  modelFactory as linearSNPCoverageDisplayModelFactory,
} from '../../LinearSNPCoverageDisplay'
import configSchemaFactory from './configSchema'

// mock warnings to avoid unnecessary outputs
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  console.warn.mockRestore()
})

class AlignmentsPlugin extends Plugin {
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

    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new SNPCoverageRenderer({
          name: 'SNPCoverageRenderer',
          ReactComponent: SNPCoverageRendererReactComponent,
          configSchema: snpCoverageRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addDisplayType(() => {
      const configSchema = linearPileupDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearPileupDisplay',
        configSchema,
        stateModel: linearPileupDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearSNPCoverageDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearSNPCoverageDisplay',
        configSchema,
        stateModel: linearSNPCoverageDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearWiggleDisplayReactComponent,
      })
    })
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
