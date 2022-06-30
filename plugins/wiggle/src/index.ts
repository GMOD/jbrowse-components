import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import { FileLocation } from '@jbrowse/core/util/types'
import WiggleBaseRenderer from './WiggleBaseRenderer'
import WiggleRendering from './WiggleRendering'
import BigWigAdapterF from './BigWigAdapter'
import QuantitativeTrackF from './QuantitativeTrack'
import MultiQuantitativeTrackF from './MultiQuantitativeTrack'
import MultiWiggleAdapterF from './MultiWiggleAdapter'
import DensityRendererF from './DensityRenderer'
import XYPlotRendererF from './XYPlotRenderer'
import LinePlotRendererF from './LinePlotRenderer'
import LinearWiggleDisplayF from './LinearWiggleDisplay'
import MultiLinearWiggleDisplayF from './MultiLinearWiggleDisplay'
import MultiXYPlotRendererF './MultiXYPlotRenderer'

import * as utils from './util'

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
    MultiWiggleAdapterF(pluginManager)
    BigWigAdapterF(pluginManager)
    QuantitativeTrackF(pluginManager)
    MultiQuantitativeTrackF(pluginManager)
    LinearWiggleDisplayF(pluginManager)
    MultiLinearWiggleDisplayF(pluginManager)
    LinePlotRendererF(pluginManager)
    XYPlotRendererF(pluginManager)
    DensityRendererF(pluginManager)
    MultiXYPlotRendererF(pluginManager)

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
          const obj = {
            type: adapterName,
            bigWigLocation: file,
          }

          if (regexGuess.test(fileName) && !adapterHint) {
            return obj
          } else if (adapterHint === adapterName) {
            return obj
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
