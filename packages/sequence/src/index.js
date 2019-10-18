import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as BgzipFastaAdapterClass,
  configSchema as bgzipFastaAdapterConfigSchema,
} from './BgzipFastaAdapter'
import {
  configSchema as divSequenceRendererConfigSchema,
  ReactComponent as DivSequenceRendererReactComponent,
} from './DivSequenceRenderer'
import {
  AdapterClass as IndexedFastaAdapterClass,
  configSchema as indexedFastaAdapterConfigSchema,
} from './IndexedFastaAdapter'
import {
  configSchemaFactory as referenceSequenceTrackConfigSchemaFactory,
  modelFactory as referenceSequenceTrackModelFactory,
} from './ReferenceSequenceTrack'
import {
  configSchemaFactory as sequenceTrackConfigSchemaFactory,
  modelFactory as sequenceTrackModelFactory,
} from './SequenceTrack'
import {
  AdapterClass as TwoBitAdapterClass,
  configSchema as twoBitAdapterConfigSchema,
} from './TwoBitAdapter'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'TwoBitAdapter',
          configSchema: twoBitAdapterConfigSchema,
          AdapterClass: TwoBitAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'IndexedFastaAdapter',
          configSchema: indexedFastaAdapterConfigSchema,
          AdapterClass: IndexedFastaAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BgzipFastaAdapter',
          configSchema: bgzipFastaAdapterConfigSchema,
          AdapterClass: BgzipFastaAdapterClass,
        }),
    )

    pluginManager.addTrackType(() => {
      const configSchema = sequenceTrackConfigSchemaFactory(
        pluginManager,
        'SequenceTrack',
      )
      return new TrackType({
        name: 'SequenceTrack',
        configSchema,
        stateModel: sequenceTrackModelFactory(configSchema, 'SequenceTrack'),
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = referenceSequenceTrackConfigSchemaFactory(
        pluginManager,
        'ReferenceSequenceTrack',
      )
      return new TrackType({
        name: 'ReferenceSequenceTrack',
        configSchema,
        stateModel: referenceSequenceTrackModelFactory(
          configSchema,
          'ReferenceSequenceTrack',
        ),
      })
    })

    pluginManager.addRendererType(
      () =>
        new ServerSideRendererType({
          name: 'DivSequenceRenderer',
          ReactComponent: DivSequenceRendererReactComponent,
          configSchema: divSequenceRendererConfigSchema,
        }),
    )
  }
}
