import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  configSchemaFactory as alignmentsTrackConfigSchemaFactory,
  modelFactory as alignmentsTrackModelFactory,
} from './AlignmentsTrack'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './AlignmentsFeatureDetail'
import {
  configSchemaFactory as pileupTrackConfigSchemaFactory,
  modelFactory as pileupTrackModelFactory,
} from './PileupTrack'
import {
  configSchemaFactory as snpCoverageTrackConfigSchemaFactory,
  modelFactory as snpCoverageTrackModelFactory,
} from './SNPCoverageTrack'
import PileupRenderer, {
  configSchema as pileupRendererConfigSchema,
  ReactComponent as PileupRendererReactComponent,
} from './PileupRenderer'
import SNPCoverageRenderer, {
  configSchema as SNPCoverageRendererConfigSchema,
  ReactComponent as SNPCoverageRendererReactComponent,
} from './SNPCoverageRenderer'

import BamAdapterF from './BamAdapter'
import CramAdapterF from './CramAdapter'
import SNPCoverageAdapterF from './SNPCoverageAdapter'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = pileupTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'PileupTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: pileupTrackModelFactory(pluginManager, configSchema),
      })
    })
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'AlignmentsFeatureWidget',
          heading: 'Feature Details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          LazyReactComponent: lazy(() => AlignmentsFeatureDetailReactComponent),
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = snpCoverageTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'SNPCoverageTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: snpCoverageTrackModelFactory(configSchema),
      })
    })
    pluginManager.addTrackType(() => {
      const configSchema = alignmentsTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'AlignmentsTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: alignmentsTrackModelFactory(pluginManager, configSchema),
      })
    })
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BamAdapter',
          ...pluginManager.load(BamAdapterF),
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'SNPCoverageAdapter',
          ...pluginManager.load(SNPCoverageAdapterF),
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'CramAdapter',
          ...pluginManager.load(CramAdapterF),
        }),
    )
    pluginManager.addRendererType(
      () =>
        // @ts-ignore error "expected 0 arguments, but got 1"?
        new PileupRenderer({
          name: 'PileupRenderer',
          ReactComponent: PileupRendererReactComponent,
          configSchema: pileupRendererConfigSchema,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new SNPCoverageRenderer({
          name: 'SNPCoverageRenderer',
          ReactComponent: SNPCoverageRendererReactComponent,
          configSchema: SNPCoverageRendererConfigSchema,
        }),
    )
  }
}
