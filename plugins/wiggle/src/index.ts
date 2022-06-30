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
import MultiXYPlotRendererF from './MultiXYPlotRenderer'
import MultiRowXYPlotRendererF from './MultiRowXYPlotRenderer'

import * as utils from './util'

import {
  WiggleGetGlobalStats,
  WiggleGetMultiRegionStats,
  MultiWiggleGetNumSources,
} from './WiggleRPC/rpcMethods'
import {
  AdapterGuesser,
  getFileName,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    MultiWiggleAdapterF(pm)
    BigWigAdapterF(pm)
    QuantitativeTrackF(pm)
    MultiQuantitativeTrackF(pm)
    LinearWiggleDisplayF(pm)
    MultiLinearWiggleDisplayF(pm)
    LinePlotRendererF(pm)
    XYPlotRendererF(pm)
    DensityRendererF(pm)
    MultiXYPlotRendererF(pm)
    MultiRowXYPlotRendererF(pm)

    pm.addToExtensionPoint(
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
    pm.addToExtensionPoint(
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

    pm.addRpcMethod(() => new WiggleGetGlobalStats(pm))
    pm.addRpcMethod(() => new WiggleGetMultiRegionStats(pm))
    pm.addRpcMethod(() => new MultiWiggleGetNumSources(pm))
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

import {
  ReactComponent as LinearWiggleDisplayReactComponent,
  modelFactory as linearWiggleDisplayModelFactory,
  Tooltip,
} from './LinearWiggleDisplay'
import {
  ReactComponent as XYPlotRendererReactComponent,
  configSchema as xyPlotRendererConfigSchema,
  XYPlotRenderer,
} from './XYPlotRenderer'

export {
  WiggleRendering,
  WiggleBaseRenderer,
  LinearWiggleDisplayReactComponent,
  linearWiggleDisplayModelFactory,
  Tooltip,
}
