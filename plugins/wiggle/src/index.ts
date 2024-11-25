import Plugin from '@jbrowse/core/Plugin'
import { getFileName } from '@jbrowse/core/util/tracks'

// locals

import BigWigAdapterF from './BigWigAdapter'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension'
import DensityRendererF from './DensityRenderer'
import LinePlotRendererF from './LinePlotRenderer'
import LinearWiggleDisplayF, {
  ReactComponent as LinearWiggleDisplayReactComponent,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay'

import MultiDensityRendererF from './MultiDensityRenderer'
import MultiLineRendererF from './MultiLineRenderer'
import MultiLinearWiggleDisplayF from './MultiLinearWiggleDisplay'
import MultiQuantitativeTrackF from './MultiQuantitativeTrack'
import MultiRowLineRendererF from './MultiRowLineRenderer'
import MultiRowXYPlotRendererF from './MultiRowXYPlotRenderer'
import MultiWiggleAdapterF from './MultiWiggleAdapter'
import MultiWiggleAddTrackWorkflowF from './MultiWiggleAddTrackWorkflow'
import MultiXYPlotRendererF from './MultiXYPlotRenderer'
import QuantitativeTrackF from './QuantitativeTrack'
import WiggleBaseRenderer from './WiggleBaseRenderer'
import {
  WiggleGetGlobalQuantitativeStats,
  WiggleGetMultiRegionQuantitativeStats,
  MultiWiggleGetSources,
} from './WiggleRPC/rpcMethods'
import XYPlotRendererF, {
  ReactComponent as XYPlotRendererReactComponent,
  configSchema as xyPlotRendererConfigSchema,
  XYPlotRenderer,
} from './XYPlotRenderer'

import * as utils from './util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

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
    MultiWiggleAddTrackWorkflowF(pm)
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
          }
          if (hint === adapterName) {
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

    pm.addRpcMethod(() => new WiggleGetGlobalQuantitativeStats(pm))
    pm.addRpcMethod(() => new WiggleGetMultiRegionQuantitativeStats(pm))
    pm.addRpcMethod(() => new MultiWiggleGetSources(pm))
  }

  exports = {
    LinearWiggleDisplayReactComponent,
    XYPlotRendererReactComponent,
    XYPlotRenderer,
    WiggleBaseRenderer,
    linearWiggleDisplayModelFactory,
    xyPlotRendererConfigSchema,
    utils,
  }
}

export * from './util'

export { default as WiggleRendering } from './WiggleRendering'
export {
  Tooltip,
  ReactComponent as LinearWiggleDisplayReactComponent,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay'
export type { TooltipContentsComponent } from './Tooltip'

export { default as WiggleBaseRenderer } from './WiggleBaseRenderer'
