import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { Region } from '@jbrowse/core/util/types'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
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
import GCContentAdapterF from './GCContentAdapter'
import { createReferenceSeqTrackConfig } from './referenceSeqTrackConfig'

/* adjust in both directions */
class DivSequenceRenderer extends FeatureRendererType {
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

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GCContentAdapter',
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
