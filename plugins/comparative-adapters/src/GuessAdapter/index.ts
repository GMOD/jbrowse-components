import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  testAdapter,
} from '@jbrowse/core/util'
import { getFileName, guessTabixIndex } from '@jbrowse/core/util/tracks'
import { syntenyTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    if (testAdapter(fileName, /\.paf(.gz)?$/i, adapterHint, 'PAFAdapter')) {
      return {
        type: 'PAFAdapter',
        pafLocation: file,
      }
    } else if (adapterHint === 'AllVsAllPAFAdapter') {
      // no file-extension guess: an all-vs-all PAF looks like any .paf, so
      // it is only reachable by explicitly picking the adapter. The
      // assembly pair / PanSN mapping are filled in by its add-track form.
      return {
        type: 'AllVsAllPAFAdapter',
        pafLocation: file,
      }
    } else if (adapterHint === 'AllVsAllIndexedPAFAdapter') {
      // an all-vs-all PIF shares the .pif.gz extension with a pairwise PIF,
      // so it is only reachable by explicitly picking the adapter; the
      // assembly list / PanSN mapping come from its add-track form.
      return {
        type: 'AllVsAllIndexedPAFAdapter',
        pifGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else if (adapterHint === 'MCScanBlocksAdapter') {
      // the extra per-genome BED files and blockAssemblies come from the
      // add-track form; this only seeds the blocks file location
      return {
        type: 'MCScanBlocksAdapter',
        mcscanBlocksLocation: file,
      }
    } else if (adapterHint === 'BlastTabularAdapter') {
      return {
        type: 'BlastTabularAdapter',
        blastTableLocation: file,
      }
    } else if (
      testAdapter(
        fileName,
        /\.anchors\.simple(.gz)?$/i,
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
        /\.anchors(.gz)?$/i,
        adapterHint,
        'MCScanAnchorsAdapter',
      )
    ) {
      return {
        type: 'MCScanAnchorsAdapter',
        mcscanAnchorsLocation: file,
      }
    } else if (
      testAdapter(fileName, /\.delta(.gz)?$/i, adapterHint, 'DeltaAdapter')
    ) {
      return {
        type: 'DeltaAdapter',
        deltaLocation: file,
      }
    } else if (
      testAdapter(fileName, /\.chain(.gz)?$/i, adapterHint, 'ChainAdapter')
    ) {
      return {
        type: 'ChainAdapter',
        chainLocation: file,
      }
    } else if (
      testAdapter(fileName, /\.out(.gz)?$/i, adapterHint, 'MashMapAdapter')
    ) {
      return {
        type: 'MashMapAdapter',
        outLocation: file,
      }
    } else if (
      testAdapter(
        fileName,
        /\.pif\.gz$/i,
        adapterHint,
        'PairwiseIndexedPAFAdapter',
      )
    ) {
      return {
        type: 'PairwiseIndexedPAFAdapter',
        pifGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else {
      return undefined
    }
  })
  addTrackTypeGuesser(pluginManager, adapterName =>
    syntenyTypes.includes(adapterName) ? 'SyntenyTrack' : undefined,
  )
}
