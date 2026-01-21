import type { Feature } from '@jbrowse/core/util'

/**
 * Session-based feature cache for variant renderers.
 * Mirrors the pattern used by BoxRendererType's layoutSessions.
 *
 * Features are stored per-refName and persist across renders.
 * discardRange() removes features overlapping a given region.
 */
export class VariantFeatureSession {
  private features = new Map<string, Feature>()

  /**
   * Add features to the cache
   */
  addFeatures(refName: string, features: Map<string, Feature>) {
    for (const [id, feature] of features) {
      this.features.set(id, feature)
    }
  }

  /**
   * Get a feature by ID
   */
  getDataByID(id: string): Feature | undefined {
    return this.features.get(id)
  }

  /**
   * Discard features overlapping a specific range (called by freeResources)
   */
  discardRange(refName: string, start: number, end: number) {
    for (const [id, feature] of this.features) {
      const fRefName = feature.get('refName')
      const fStart = feature.get('start')
      const fEnd = feature.get('end')
      if (fRefName === refName && fStart < end && fEnd > start) {
        this.features.delete(id)
      }
    }
  }
}

function getLayoutId(args: { sessionId: string; trackInstanceId: string }) {
  return `${args.sessionId}-${args.trackInstanceId}`
}

/**
 * Shared feature cache manager for variant renderers.
 * Provides the same interface as BoxRendererType's layout session management.
 */
export class VariantFeatureCacheManager {
  private sessions: Record<string, VariantFeatureSession> = {}

  getSession(args: { sessionId: string; trackInstanceId: string }) {
    const key = getLayoutId(args)
    if (!this.sessions[key]) {
      this.sessions[key] = new VariantFeatureSession()
    }
    return this.sessions[key]
  }

  freeResources(args: {
    sessionId: string
    trackInstanceId: string
    regions: { refName: string; start: number; end: number }[]
  }) {
    const key = getLayoutId(args)
    const session = this.sessions[key]
    if (session) {
      const region = args.regions[0]
      if (region) {
        session.discardRange(region.refName, region.start, region.end)
      }
    }
  }

  deleteSession(args: { sessionId: string; trackInstanceId: string }) {
    const key = getLayoutId(args)
    delete this.sessions[key]
  }
}
