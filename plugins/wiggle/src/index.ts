import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  AdapterClass as BigWigAdapterClass,
  configSchema as bigWigAdapterConfigSchema,
} from './BigWigAdapter'
import DensityRenderer, {
  configSchema as densityRendererConfigSchema,
  ReactComponent as DensityRendererReactComponent,
} from './DensityRenderer'
import {
  configSchemaFactory as linearWiggleDisplayConfigSchemaFactory,
  modelFactory as linearWiggleDisplayModelFactory,
  ReactComponent as LinearWiggleDisplayReactComponent,
} from './LinearWiggleDisplay'
import XYPlotRenderer, {
  configSchema as xyPlotRendererConfigSchema,
  ReactComponent as XYPlotRendererReactComponent,
} from './XYPlotRenderer'
import LinePlotRenderer, {
  configSchema as linePlotRendererConfigSchema,
  ReactComponent as LinePlotRendererReactComponent,
} from './LinePlotRenderer'
import {
  WiggleGetGlobalStats,
  WiggleGetMultiRegionStats,
} from './WiggleRPC/rpcMethods'

export default class extends Plugin {
  name = 'WigglePlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'QuantitativeTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      return new TrackType({
        name: 'QuantitativeTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'QuantitativeTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearWiggleDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearWiggleDisplay',
        configSchema,
        stateModel: linearWiggleDisplayModelFactory(configSchema),
        trackType: 'QuantitativeTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearWiggleDisplayReactComponent,
      })
    })

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigWigAdapter',
          configSchema: bigWigAdapterConfigSchema,
          AdapterClass: BigWigAdapterClass,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new DensityRenderer({
          name: 'DensityRenderer',
          ReactComponent: DensityRendererReactComponent,
          configSchema: densityRendererConfigSchema,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new LinePlotRenderer({
          name: 'LinePlotRenderer',
          ReactComponent: LinePlotRendererReactComponent,
          configSchema: linePlotRendererConfigSchema,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new XYPlotRenderer({
          name: 'XYPlotRenderer',
          ReactComponent: XYPlotRendererReactComponent,
          configSchema: xyPlotRendererConfigSchema,
        }),
    )

    pluginManager.addRpcMethod(() => new WiggleGetGlobalStats(pluginManager))
    pluginManager.addRpcMethod(
      () => new WiggleGetMultiRegionStats(pluginManager),
    )
  }
}

export * from './statsUtil'
export * from './util'

export { default as WiggleRendering } from './WiggleRendering'
export { default as WiggleBaseRenderer } from './WiggleBaseRenderer'
export { LinearWiggleDisplayReactComponent, linearWiggleDisplayModelFactory }
