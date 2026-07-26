import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface SyntenyFeatureDetailModel {
  // BaseFeatureWidget declares this `types.maybe(types.string)` and only fills
  // it in once the widget's track reference resolves
  trackId?: string
  featureData?: SimpleFeatureSerialized
  level?: number
  view: {
    type: string
  }
}
