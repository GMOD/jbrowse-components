import { testAdapter } from '@jbrowse/core/util'
import {
  getFileName,
  makeIndex,
  makeIndexType,
} from '@jbrowse/core/util/tracks'

import { syntenyTypes } from '../syntenyTypes'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessAdapterF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)
        if (testAdapter(fileName, /\.paf(.gz)?/i, adapterHint, 'PAFAdapter')) {
          return {
            type: 'PAFAdapter',
            pafLocation: file,
          }
        } else if (adapterHint === 'BlastTabularAdapter') {
          return {
            type: 'BlastTabularAdapter',
            blastTableLocation: file,
          }
        } else if (
          testAdapter(
            fileName,
            /\.anchors.simple(.gz)?/i,
            adapterHint,
            'MCScanSimpleAnchorsAdapter',
          )
        ) {
          return {
            type: 'MCScanSimpleAnchorsAdapter',
            mcscanSimpleAnchorsLocation: file,
          }
        } else if (
          testAdapter(
            fileName,
            /\.anchors(.gz)?/i,
            adapterHint,
            'MCScanAnchorsAdapter',
          )
        ) {
          return {
            type: 'MCScanAnchorsAdapter',
            mcscanAnchorsLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.delta(.gz)?/i, adapterHint, 'DeltaAdapter')
        ) {
          return {
            type: 'DeltaAdapter',
            deltaLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.chain(.gz)?/i, adapterHint, 'ChainAdapter')
        ) {
          return {
            type: 'ChainAdapter',
            chainLocation: file,
          }
        } else if (
          testAdapter(fileName, /\.out(.gz)?/i, adapterHint, 'MashMapAdapter')
        ) {
          return {
            type: 'MashMapAdapter',
            outLocation: file,
          }
        } else if (
          testAdapter(
            fileName,
            /\.pif\.gz/i,
            adapterHint,
            'PairwiseIndexedPAFAdapter',
          )
        ) {
          return {
            type: 'PairwiseIndexedPAFAdapter',
            pifGzLocation: file,
            index: {
              location: index || makeIndex(file, '.tbi'),
              indexType: makeIndexType(indexName, 'CSI', 'TBI'),
            },
          }
        } else {
          return adapterGuesser(file, index, adapterHint)
        }
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string, fileName?: string) =>
        syntenyTypes.includes(adapterName)
          ? 'SyntenyTrack'
          : trackTypeGuesser(adapterName, fileName)
    },
  )
}
