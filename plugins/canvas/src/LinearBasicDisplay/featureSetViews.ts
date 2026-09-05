import { toggleArrayMember } from '../shared/toggleArrayMember.ts'

import type { IObservableArray } from 'mobx'

export interface FeatureSetHost {
  pinnedFeatureIds: IObservableArray<string>
  soloFeatureIds: IObservableArray<string>
  hiddenFeatureIds: IObservableArray<string>
  expandedGeneIds: IObservableArray<string>
  soloApplied: boolean
  setScrollTop: (n: number) => void
}

export function featureSetViews(self: FeatureSetHost) {
  return {
    /**
     * #getter
     */
    // MobX caches the Set, so its reference is stable until the array
    // mutates, which is what lets the layout cache compare pins by reference.
    get pinnedFeatureIdSet(): ReadonlySet<string> {
      return new Set(self.pinnedFeatureIds)
    },

    /**
     * #getter
     */
    get expandedGeneIdSet(): ReadonlySet<string> {
      return new Set(self.expandedGeneIds)
    },

    /**
     * #getter
     */
    get soloFeatureIdSet(): ReadonlySet<string> {
      return new Set(self.soloFeatureIds)
    },

    /**
     * #getter
     */
    get hiddenFeatureCount() {
      return self.hiddenFeatureIds.length
    },

    /**
     * #getter
     */
    get soloFeatureCount() {
      return self.soloFeatureIds.length
    },

    /**
     * #getter
     */
    get pinnedFeatureCount() {
      return self.pinnedFeatureIds.length
    },
  }
}

export function featureSetActions(self: FeatureSetHost) {
  return {
    /**
     * #action
     */
    // Pinning resets scroll: the feature lands in a top row, and a track
    // scrolled past that row would show "Pin to top" making the feature
    // vanish upward.
    togglePinnedFeature(featureId: string) {
      toggleArrayMember(self.pinnedFeatureIds, featureId)
      if (self.pinnedFeatureIds.includes(featureId)) {
        self.setScrollTop(0)
      }
    },

    /**
     * #action
     */
    clearPinnedFeatures() {
      self.pinnedFeatureIds.clear()
    },

    /**
     * #action
     * Open or re-collapse one gene's isoforms, from the badge on its own
     * label.
     */
    toggleExpandedGene(featureId: string) {
      toggleArrayMember(self.expandedGeneIds, featureId)
    },

    /**
     * #action
     * Re-collapse every gene opened from a badge.
     */
    clearExpandedGenes() {
      self.expandedGeneIds.clear()
    },

    /**
     * #action
     */
    toggleSoloFeature(featureId: string) {
      toggleArrayMember(self.soloFeatureIds, featureId)
      if (self.soloFeatureIds.length === 0) {
        self.soloApplied = false
      }
    },

    /**
     * #action
     */
    applySolo() {
      if (self.soloFeatureIds.length > 0) {
        self.soloApplied = true
      }
    },

    /**
     * #action
     */
    soloFeature(featureId: string) {
      self.soloFeatureIds.replace([featureId])
      self.soloApplied = true
    },

    /**
     * #action
     */
    clearSolo() {
      self.soloFeatureIds.clear()
      self.soloApplied = false
    },

    /**
     * #action
     */
    hideFeature(featureId: string) {
      if (!self.hiddenFeatureIds.includes(featureId)) {
        self.hiddenFeatureIds.push(featureId)
      }
    },

    /**
     * #action
     */
    // Resets scroll so a re-shown feature, which re-enters layout as new and
    // first-fits to a top row, lands in view.
    showAllHidden() {
      self.hiddenFeatureIds.clear()
      self.setScrollTop(0)
    },
  }
}
