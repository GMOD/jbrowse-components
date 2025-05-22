import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface SyntenyFeatureDetailModel {
  trackId: string
  featureData?: SimpleFeatureSerialized
  level?: number
  view: {
    type: string
  }
}
