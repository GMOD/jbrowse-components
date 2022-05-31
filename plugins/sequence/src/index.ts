import { Region, FileLocation } from '@jbrowse/core/util/types'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import {
  makeIndex,
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

// locals
import { configSchema as bgzipFastaAdapterConfigSchema } from './BgzipFastaAdapter'
import { configSchema as chromSizesAdapterConfigSchema } from './ChromSizesAdapter'
import {
  configSchema as divSequenceRendererConfigSchema,
  ReactComponent as DivSequenceRendererReactComponent,
} from './DivSequenceRenderer'
import { configSchema as indexedFastaAdapterConfigSchema } from './IndexedFastaAdapter'
import {
  configSchema as linearReferenceSequenceDisplayConfigSchema,
  modelFactory as linearReferenceSequenceDisplayModelFactory,
} from './LinearReferenceSequenceDisplay'
import { configSchema as twoBitAdapterConfigSchema } from './TwoBitAdapter'
import GCContentAdapterF from './GCContentAdapter'
import { createReferenceSeqTrackConfig } from './referenceSeqTrackConfig'

/* adjust in both directions */
class DivSequenceRenderer extends FeatureRendererType {
  supportsSVG = true

  getExpandedRegion(region: Region) {
    return {
      ...region,
      start: Math.max(region.start - 3, 0),
      end: region.end + 3,
    }
  }
}

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'TwoBitAdapter',
          configSchema: twoBitAdapterConfigSchema,
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          getAdapterClass: () =>
            import('./TwoBitAdapter/TwoBitAdapter').then(r => r.default),
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
          const regexGuess = /\.2bit$/i
          const adapterName = 'TwoBitAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            twoBitLocation: file,
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
          if (adapterName === 'TwoBitAdapter') {
            return 'ReferenceSequenceTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'ChromSizesAdapter',
          configSchema: chromSizesAdapterConfigSchema,
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          getAdapterClass: () =>
            import('./ChromSizesAdapter/ChromSizesAdapter').then(
              r => r.default,
            ),
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'IndexedFastaAdapter',
          configSchema: indexedFastaAdapterConfigSchema,
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          getAdapterClass: () =>
            import('./IndexedFastaAdapter/IndexedFastaAdapter').then(
              r => r.default,
            ),
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
          const regexGuess = /\.(fa|fasta|fas|fna|mfa)$/i
          const adapterName = 'IndexedFastaAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            fastaLocation: file,
            faiLocation: index || makeIndex(file, '.fai'),
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
          if (adapterName === 'IndexedFastaAdapter') {
            return 'ReferenceSequenceTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BgzipFastaAdapter',
          configSchema: bgzipFastaAdapterConfigSchema,
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          getAdapterClass: () =>
            import('./BgzipFastaAdapter/BgzipFastaAdapter').then(
              r => r.default,
            ),
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
          const regexGuess = /\.(fa|fasta|fas|fna|mfa)\.b?gz$/i
          const adapterName = 'BgzipFastaAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            faiLocation: makeIndex(file, '.fai'),
            gziLocation: makeIndex(file, '.gzi'),
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
          if (adapterName === 'BgzipFastaAdapter') {
            return 'ReferenceSequenceTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GCContentAdapter',
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
          ...pluginManager.load(GCContentAdapterF),
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = createReferenceSeqTrackConfig(pluginManager)

      return new TrackType({
        name: 'ReferenceSequenceTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'ReferenceSequenceTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const stateModel = linearReferenceSequenceDisplayModelFactory(
        linearReferenceSequenceDisplayConfigSchema,
      )
      return {
        name: 'LinearReferenceSequenceDisplay',
        configSchema: linearReferenceSequenceDisplayConfigSchema,
        stateModel,
        trackType: 'ReferenceSequenceTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }
    })

    pluginManager.addRendererType(
      () =>
        new DivSequenceRenderer({
          name: 'DivSequenceRenderer',
          ReactComponent: DivSequenceRendererReactComponent,
          configSchema: divSequenceRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}
