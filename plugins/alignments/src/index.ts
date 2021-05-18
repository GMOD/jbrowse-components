import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  stateModelFactory as alignmentsFeatureDetailStateModelFactory,
} from './AlignmentsFeatureDetail'
import BamAdapterF from './BamAdapter'
import * as MismatchParser from './BamAdapter/MismatchParser'
import CramAdapterF from './CramAdapter'
import HtsgetBamAdapterF from './HtsgetBamAdapter'
import {
  configSchemaFactory as linearAligmentsDisplayConfigSchemaFactory,
  modelFactory as linearAlignmentsDisplayModelFactory,
  ReactComponent as LinearAlignmentsDisplayReactComponent,
} from './LinearAlignmentsDisplay'
import {
  configSchemaFactory as linearPileupDisplayConfigSchemaFactory,
  modelFactory as linearPileupDisplayModelFactory,
} from './LinearPileupDisplay'
import {
  configSchemaFactory as linearSNPCoverageDisplayConfigSchemaFactory,
  modelFactory as linearSNPCoverageDisplayModelFactory,
} from './LinearSNPCoverageDisplay'
import PileupRenderer, {
  configSchema as pileupRendererConfigSchema,
  ReactComponent as PileupRendererReactComponent,
} from './PileupRenderer'
import SNPCoverageAdapterF from './SNPCoverageAdapter'
import SNPCoverageRenderer, {
  configSchema as SNPCoverageRendererConfigSchema,
  ReactComponent as SNPCoverageRendererReactComponent,
} from './SNPCoverageRenderer'
import {
  PileupGetGlobalValueForTag,
  PileupGetVisibleModifications,
} from './PileupRPC/rpcMethods'

export { MismatchParser }

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'AlignmentsTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      const track = new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'AlignmentsTrack',
          configSchema,
        ),
      })
      const linearAlignmentsDisplay = pluginManager.getDisplayType(
        'LinearAlignmentsDisplay',
      )
      // Add LinearAlignmentsDisplay here so that it has priority over the other
      // linear displays (defaults to order the displays are added, but we have
      // to add the Pileup and SNPCoverage displays first).
      track.addDisplayType(linearAlignmentsDisplay)
      return track
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearPileupDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearPileupDisplay',
        configSchema,
        stateModel: linearPileupDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearSNPCoverageDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearSNPCoverageDisplay',
        configSchema,
        stateModel: linearSNPCoverageDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearWiggleDisplayReactComponent,
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearAligmentsDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: linearAlignmentsDisplayModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearAlignmentsDisplayReactComponent,
      })
    })
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'AlignmentsFeatureWidget',
          heading: 'Feature details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModelFactory(pluginManager),
          ReactComponent: lazy(
            () => import('./AlignmentsFeatureDetail/AlignmentsFeatureDetail'),
          ),
        }),
    )
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
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'HtsgetBamAdapter',
          ...pluginManager.load(HtsgetBamAdapterF),
        }),
    )
    pluginManager.addRendererType(
      () =>
        new PileupRenderer({
          name: 'PileupRenderer',
          ReactComponent: PileupRendererReactComponent,
          configSchema: pileupRendererConfigSchema,
          pluginManager,
        }),
    )
    pluginManager.addRendererType(
      () =>
        new SNPCoverageRenderer({
          name: 'SNPCoverageRenderer',
          ReactComponent: SNPCoverageRendererReactComponent,
          configSchema: SNPCoverageRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addRpcMethod(
      () => new PileupGetGlobalValueForTag(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new PileupGetVisibleModifications(pluginManager),
    )
  }
}
