import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './AlignmentsFeatureDetail'
import {
  configSchemaFactory as alignmentsTrackConfigSchemaFactory,
  modelFactory as alignmentsTrackModelFactory,
} from './AlignmentsTrack'
import {
  configSchemaFactory as snpTrackConfigSchemaFactory,
  modelFactory as snpTrackModelFactory,
} from './SNPTrack'
import {
  AdapterClass as SnpAdapterClass,
  configSchema as snpAdapterConfigSchema,
} from './SNPAdapter'
import {
  AdapterClass as BamAdapterClass,
  configSchema as bamAdapterConfigSchema,
} from './BamAdapter'
import {
  AdapterClass as CramAdapterClass,
  configSchema as cramAdapterConfigSchema,
} from './CramAdapter'
import PileupRenderer, {
  configSchema as pileupRendererConfigSchema,
  ReactComponent as PileupRendererReactComponent,
} from './PileupRenderer'
import SNPXYRenderer, {
  configSchema as SNPRendererConfigSchema,
  ReactComponent as SNPRendererReactComponent,
} from './SNPXYRenderer'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = alignmentsTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel: alignmentsTrackModelFactory(pluginManager, configSchema),
      })
    })

    pluginManager.addDrawerWidgetType(
      () =>
        new DrawerWidgetType({
          name: 'AlignmentsFeatureDrawerWidget',
          heading: 'Feature Details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          LazyReactComponent: lazy(() => AlignmentsFeatureDetailReactComponent),
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = snpTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'SNPTrack',
        configSchema,
        stateModel: snpTrackModelFactory(configSchema),
      })
    })
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BamAdapter',
          configSchema: bamAdapterConfigSchema,
          AdapterClass: BamAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'SNPAdapter',
          configSchema: snpAdapterConfigSchema,
          AdapterClass: SnpAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'CramAdapter',
          requiresSequenceAdapter: true,
          configSchema: cramAdapterConfigSchema,
          AdapterClass: CramAdapterClass,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new PileupRenderer({
          name: 'PileupRenderer',
          ReactComponent: PileupRendererReactComponent,
          configSchema: pileupRendererConfigSchema,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new SNPXYRenderer({
          name: 'SNPXYRenderer',
          ReactComponent: SNPRendererReactComponent,
          configSchema: SNPRendererConfigSchema,
        }),
    )
  }
}
