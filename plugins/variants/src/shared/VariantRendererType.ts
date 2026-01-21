import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

import { VariantFeatureCacheManager } from './VariantFeatureCache.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * Base renderer type for variant displays.
 * Provides session-based feature caching following the same pattern as BoxRendererType.
 */
export default class VariantRendererType extends FeatureRendererType {
  featureCacheManager = new VariantFeatureCacheManager()

  getFeatureById(
    featureId: string,
    args: { sessionId: string; trackInstanceId: string },
  ): Feature | undefined {
    return this.featureCacheManager.getSession(args).getDataByID(featureId)
  }

  freeResources(args: {
    sessionId: string
    trackInstanceId: string
    regions: { refName: string; start: number; end: number }[]
  }) {
    this.featureCacheManager.freeResources(args)
  }

  /**
   * Helper to add features to the session cache.
   * Call this in render() after fetching features.
   */
  protected cacheFeatures(
    args: { sessionId: string; trackInstanceId: string },
    refName: string,
    features: Map<string, Feature>,
  ) {
    const session = this.featureCacheManager.getSession(args)
    session.addFeatures(refName, features)
  }
}
