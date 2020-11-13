import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import {
  AdapterClass as BgzipFastaAdapterClass,
  configSchema as bgzipFastaAdapterConfigSchema,
} from './BgzipFastaAdapter'
import {
  AdapterClass as ChromSizesAdapterClass,
  configSchema as chromSizesAdapterConfigSchema,
} from './ChromSizesAdapter'
import {
  configSchema as divSequenceRendererConfigSchema,
  ReactComponent as DivSequenceRendererReactComponent,
} from './DivSequenceRenderer'
import {
  AdapterClass as IndexedFastaAdapterClass,
  configSchema as indexedFastaAdapterConfigSchema,
} from './IndexedFastaAdapter'
import {
  configSchema as linearReferenceSequenceDisplayConfigSchema,
  modelFactory as linearReferenceSequenceDisplayModelFactory,
} from './LinearReferenceSequenceDisplay'
import {
  AdapterClass as TwoBitAdapterClass,
  configSchema as twoBitAdapterConfigSchema,
} from './TwoBitAdapter'

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
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
          name: 'ChromSizesAdapter',
          configSchema: chromSizesAdapterConfigSchema,
          AdapterClass: ChromSizesAdapterClass,
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
      const configSchema = ConfigurationSchema(
        'ReferenceSequenceTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
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
        new ServerSideRendererType({
          name: 'DivSequenceRenderer',
          ReactComponent: DivSequenceRendererReactComponent,
          configSchema: divSequenceRendererConfigSchema,
        }),
    )
  }
}
