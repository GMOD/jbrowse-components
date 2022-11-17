import { FileLocation } from '@jbrowse/core/util/types'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import * as MismatchParser from './BamAdapter/MismatchParser'
import { LinearPileupDisplayModel } from './LinearPileupDisplay/model'

import BamAdapterF from './CramAdapter'
import CramAdapterF from './BamAdapter'
import HtsgetBamAdapterF from './HtsgetBamAdapter'
import SNPCoverageAdapterF from './SNPCoverageAdapter'
import SNPCoverageRendererF from './SNPCoverageRenderer'
import PileupRendererF from './PileupRenderer'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay'
import LinearSNPCoverageDisplayF from './LinearSNPCoverageDisplay'
import LinearPileupDisplayF, {
  linearPileupDisplayStateModelFactory,
  linearPileupDisplayConfigSchemaFactory,
} from './LinearPileupDisplay'
import AlignmentsTrackF from './AlignmentsTrack'
import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail'

import {
  PileupGetGlobalValueForTag,
  PileupGetVisibleModifications,
} from './PileupRPC/rpcMethods'
import {
  makeIndex,
  makeIndexType,
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      LinearPileupDisplayF,
      LinearSNPCoverageDisplayF,
      AlignmentsTrackF,
      SNPCoverageAdapterF,
      HtsgetBamAdapterF,
      PileupRendererF,
      SNPCoverageRendererF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
    ].map(f => f(pluginManager))

    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.cram$/i
          const adapterName = 'CramAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            cramLocation: file,
            craiLocation: index || makeIndex(file, '.crai'),
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
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.bam$/i
          const adapterName = 'BamAdapter'
          const fileName = getFileName(file)
          const indexName = index && getFileName(index)

          const obj = {
            type: adapterName,
            bamLocation: file,
            index: {
              location: index || makeIndex(file, '.bai'),
              indexType: makeIndexType(indexName, 'CSI', 'BAI'),
            },
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
          if (adapterName === 'BamAdapter' || adapterName === 'CramAdapter') {
            return 'AlignmentsTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    pluginManager.addRpcMethod(
      () => new PileupGetGlobalValueForTag(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new PileupGetVisibleModifications(pluginManager),
    )
  }
}

export {
  linearPileupDisplayConfigSchemaFactory,
  linearPileupDisplayStateModelFactory,
  MismatchParser,
}
export type { LinearPileupDisplayModel }
