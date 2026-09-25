import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { FeatureDetailsModel } from '@jbrowse/core/BaseFeatureWidget'
import type {
  AbstractViewModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface SyntenyFeatureDetailModel extends FeatureDetailsModel {
  // BaseFeatureWidget declares this `types.maybe(types.string)` and only fills
  // it in once the widget's track reference resolves
  trackId?: string
  featureData?: SimpleFeatureSerialized
  unformattedFeatureData?: SimpleFeatureSerialized
  error?: unknown
  level?: number
  // A plain LGV when opened from an LGVSyntenyDisplay's own context menu, the
  // outer LinearSyntenyView itself when opened from a ribbon click (in which
  // case `level` says which row-pair produced the feature), or a view with no
  // linear row at all — the circular view's ribbons.
  view: LinearGenomeViewModel | LinearSyntenyViewModel | AbstractViewModel
}
