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
// import {
//   configSchemaFactory as alignmentsTrackConfigSchemaFactory,
//   modelFactory as alignmentsTrackModelFactory,
//   ReactComponent as AlignmentsTrackReactComponent,
// } from './AlignmentsTrack'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './AlignmentsFeatureDetail'
import BamAdapterF from './BamAdapter'
import * as MismatchParser from './BamAdapter/MismatchParser'
import CramAdapterF from './CramAdapter'
import HtsgetBamAdapterF from './HtsgetBamAdapter'
import {
  configSchemaFactory as linearPileupDisplayConfigSchemaFactory,
  modelFactory as linearPileupDisplayTrackModelFactory,
} from './LinearPileupDisplay'
import {
  configSchemaFactory as linearSNPCoverageDisplayConfigSchemaFactory,
  modelFactory as linearSNPCoverageDisplayTrackModelFactory,
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
      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'AlignmentsTrack',
          configSchema,
        ),
      })
    })
    pluginManager.addDisplayType(() => {
      const configSchema = linearPileupDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearPileupDisplay',
        configSchema,
        stateModel: linearPileupDisplayTrackModelFactory(
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
        stateModel: linearSNPCoverageDisplayTrackModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: LinearWiggleDisplayReactComponent,
      })
    })
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'AlignmentsFeatureWidget',
          heading: 'Feature Details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          ReactComponent: AlignmentsFeatureDetailReactComponent,
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
