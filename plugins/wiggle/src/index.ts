import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  AdapterGuesser,
  TrackTypeGuesser,
  getFileName,
} from '@jbrowse/core/util/tracks'

// locals
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
import MultiDensityRendererF from './MultiDensityRenderer'
import MultiLineRendererF from './MultiLineRenderer'
import MultiRowLineRendererF from './MultiRowLineRenderer'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension'
import MultiWiggleAddTrackWidgetF from './MultiWiggleAddTrackWidget'

import * as utils from './util'

import {
  WiggleGetGlobalStats,
  WiggleGetMultiRegionStats,
  MultiWiggleGetSources,
} from './WiggleRPC/rpcMethods'

import {
  ReactComponent as LinearWiggleDisplayReactComponent,
  modelFactory as linearWiggleDisplayModelFactory,
  Tooltip,
} from './LinearWiggleDisplay'
import { TooltipContentsComponent } from './Tooltip'
import {
  ReactComponent as XYPlotRendererReactComponent,
  configSchema as xyPlotRendererConfigSchema,
  XYPlotRenderer,
} from './XYPlotRenderer'

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
    MultiDensityRendererF(pm)
    MultiLineRendererF(pm)
    MultiRowLineRendererF(pm)
    MultiWiggleAddTrackWidgetF(pm)
    CreateMultiWiggleExtensionF(pm)

    pm.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (cb: AdapterGuesser) => {
        return (file: FileLocation, index?: FileLocation, hint?: string) => {
          const regexGuess = /\.(bw|bigwig)$/i
          const adapterName = 'BigWigAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            bigWigLocation: file,
          }

          if (regexGuess.test(fileName) && !hint) {
            return obj
          } else if (hint === adapterName) {
            return obj
          }

          return cb(file, index, hint)
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
    pm.addRpcMethod(() => new MultiWiggleGetSources(pm))
  }

  exports = {
    LinearWiggleDisplayReactComponent,
    XYPlotRendererReactComponent,
    XYPlotRenderer,
    WiggleBaseRenderer,

    xyPlotRendererConfigSchema,
    utils,
    linearWiggleDisplayModelFactory,
  }
}

export * from './util'

export {
  LinearWiggleDisplayReactComponent,
  Tooltip,
  WiggleRendering,
  WiggleBaseRenderer,
  linearWiggleDisplayModelFactory,
}

export type { TooltipContentsComponent }
