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
import { FileLocation } from '@jbrowse/core/util/types'
import WiggleBaseRenderer from './WiggleBaseRenderer'
import WiggleRendering from './WiggleRendering'
import { configSchema as bigWigAdapterConfigSchema } from './BigWigAdapter'
import DensityRenderer, {
  configSchema as densityRendererConfigSchema,
  ReactComponent as DensityRendererReactComponent,
} from './DensityRenderer'
import * as utils from './util'
import {
  configSchemaFactory as linearWiggleDisplayConfigSchemaFactory,
  modelFactory as linearWiggleDisplayModelFactory,
  ReactComponent as LinearWiggleDisplayReactComponent,
  YSCALEBAR_LABEL_OFFSET,
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
import {
  AdapterGuesser,
  getFileName,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class WigglePlugin extends Plugin {
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
        stateModel: linearWiggleDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
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
          adapterCapabilities: [
            'hasResolution',
            'hasLocalStats',
            'hasGlobalStats',
          ],
          getAdapterClass: () =>
            import('./BigWigAdapter/BigWigAdapter').then(r => r.default),
        }),
    )
    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.(bw|bigwig)$/i
          const adapterName = 'BigWigAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              bigWigLocation: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => {
        return (adapterName: string) => {
          if (adapterName === 'BigWigAdapter') {
            return 'QuantitativeTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    pluginManager.addRendererType(
      () =>
        new DensityRenderer({
          name: 'DensityRenderer',
          ReactComponent: DensityRendererReactComponent,
          configSchema: densityRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new LinePlotRenderer({
          name: 'LinePlotRenderer',
          ReactComponent: LinePlotRendererReactComponent,
          configSchema: linePlotRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addRendererType(
      () =>
        new XYPlotRenderer({
          name: 'XYPlotRenderer',
          ReactComponent: XYPlotRendererReactComponent,
          configSchema: xyPlotRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addRpcMethod(() => new WiggleGetGlobalStats(pluginManager))
    pluginManager.addRpcMethod(
      () => new WiggleGetMultiRegionStats(pluginManager),
    )
  }

  exports = {
    LinearWiggleDisplayReactComponent,
    XYPlotRendererReactComponent,
    XYPlotRenderer,
    xyPlotRendererConfigSchema,
    utils,
    WiggleBaseRenderer,
    linearWiggleDisplayModelFactory,
  }
}

export * from './util'

export { WiggleRendering }
export { WiggleBaseRenderer }
export { LinearWiggleDisplayReactComponent, linearWiggleDisplayModelFactory }
export { Tooltip } from './LinearWiggleDisplay/components/Tooltip'
export { YSCALEBAR_LABEL_OFFSET }
