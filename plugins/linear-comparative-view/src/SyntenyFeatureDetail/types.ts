import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { FeatureDetailsModel } from '@jbrowse/core/BaseFeatureWidget'
import type { TrackConfigModel } from '@jbrowse/core/pluggableElementTypes/models'
import type {
  AbstractViewModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface SyntenyFeatureDetailModel extends FeatureDetailsModel {
  // BaseFeatureWidget declares this `types.maybe(types.string)` and only fills
  // it in once the widget's track reference resolves
  trackId?: string
  // The launched view needs the track back, so the launches are offered only
  // when the widget's track id resolves to a config, a connection's included
  trackConfiguration: TrackConfigModel | undefined
  featureData?: SimpleFeatureSerialized
  unformattedFeatureData?: SimpleFeatureSerialized
  error?: unknown
  level?: number
  // A plain LGV when opened from an LGVSyntenyDisplay's own context menu, the
  // outer LinearSyntenyView itself when opened from a ribbon click (in which
  // case `level` says which row-pair produced the feature), or a view with no
  // linear row at all — the circular view's ribbons.
  view:
    | LinearGenomeViewModel
    | LinearSyntenyViewModel
    | (AbstractViewModel & { assemblyNames: string[] })
}
