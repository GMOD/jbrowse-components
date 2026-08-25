import { toggleArrayMember } from './baseModelHelpers.ts'

import type { IObservableArray } from 'mobx'

/**
 * The four persisted id lists a canvas display narrows or re-orders its layout
 * with, plus the applied flag the solo collection is gated on. Declared as
 * observable arrays rather than by importing the model type, so this stays a
 * plain layer the display installs (ADR-041) instead of a mixin.
 */
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
    // MobX caches this, so the returned Set keeps a stable reference until
    // pinnedFeatureIds mutates — letting the layout cache detect a pin
    // toggle with a cheap reference compare (see groupUnchanged).
    get pinnedFeatureIdSet(): ReadonlySet<string> {
      return new Set(self.pinnedFeatureIds)
    },

    /**
     * #getter
     */
    // Genes the user opened from their own badge, as a set the layout can key
    // on — stable by reference until the array mutates, like
    // `pinnedFeatureIdSet` above and for the same reason (groupUnchanged).
    get expandedGeneIdSet(): ReadonlySet<string> {
      return new Set(self.expandedGeneIds)
    },

    /**
     * #getter
     */
    // Membership set for the "show only these features" collection; drives
    // the overlay highlight and the context-menu toggle labels.
    get soloFeatureIdSet(): ReadonlySet<string> {
      return new Set(self.soloFeatureIds)
    },

    /**
     * #getter
     */
    // How many features the user has hidden one at a time, for the
    // "Show N hidden features" recovery item. The menu builders read this
    // rather than the array, so their structural `self` types ask for a
    // number instead of an observable they'd only call `.length` on.
    get hiddenFeatureCount() {
      return self.hiddenFeatureIds.length
    },

    /**
     * #getter
     */
    // Size of the show-only list, whether or not it has been applied.
    // `soloFeatureIdSet.size` would answer the same question, but that
    // getter allocates a Set for membership tests the count doesn't need.
    get soloFeatureCount() {
      return self.soloFeatureIds.length
    },

    /**
     * #getter
     */
    // How many features are pinned to the top, for the "Unpin N features"
    // recovery item. The array's length rather than `pinnedFeatureIdSet.size`
    // for the same reason as `soloFeatureCount`: the count needs no Set.
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
    // Pin/unpin a feature to the top of the layout. Toggling mutates the
    // observable array, which reruns the layout (see pinnedFeatureIdSet)
    // and animates the feature to/from its top row via the Y morph.
    //
    // Pinning also resets scroll, for the reason `showAllHidden` does: the
    // feature lands in a top row, and a track scrolled past that row would
    // show the user's "Pin to top" making the feature vanish upward. A pin
    // does not shrink the content, so the layout autorun's maxScroll clamp
    // never fires here. Unpinning leaves the scroll alone — that returns the
    // feature to its natural row and is not a request to look at anything.
    togglePinnedFeature(featureId: string) {
      toggleArrayMember(self.pinnedFeatureIds, featureId)
      if (self.pinnedFeatureIds.includes(featureId)) {
        self.setScrollTop(0)
      }
    },

    /**
     * #action
     */
    // Unpin every feature. The track-level counterpart of the per-feature
    // "Unpin from top", and the only way back once the pinned feature is out
    // of reach: `togglePinnedFeature` needs the feature under the cursor, and
    // a pin outlives the navigation that created it — nothing on screen marks
    // a pinned feature, and the set persists in the snapshot, so a pin left on
    // another chromosome goes on claiming a top row wherever it is drawn with
    // no affordance naming it. Same gap, and the same shape of answer, as
    // `clearFeatureHighlights`.
    clearPinnedFeatures() {
      self.pinnedFeatureIds.clear()
    },

    /**
     * #action
     * Open or re-collapse one gene's isoforms, from the badge on its own
     * label. Nothing else has to change: the trim reports what it WOULD hide
     * for a gene in the set as well as for one out of it (see
     * `IsoformTrimPlan.expandedHidden`), so the badge that opened a gene is the
     * badge that closes it again.
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
    // Add/remove a feature from the "show only" collection. Ctrl+clicking a
    // feature and the right-click "Add/Remove" item both route here. If a
    // removal empties an applied set, drop back to showing everything.
    toggleSoloFeature(featureId: string) {
      toggleArrayMember(self.soloFeatureIds, featureId)
      // A removal that empties an applied set drops back to showing all
      // (adding never empties, so this only fires on removal).
      if (self.soloFeatureIds.length === 0) {
        self.soloApplied = false
      }
    },

    /**
     * #action
     */
    // Isolate to the collected set (worker drops non-members). No transient
    // snackbar: the persistent SoloSelectionChip is both the confirmation
    // and the later-undo affordance (its × clears the set at any time), so a
    // toast that auto-hides would only duplicate it and vanish before the
    // user finishes exploring.
    applySolo() {
      if (self.soloFeatureIds.length > 0) {
        self.soloApplied = true
      }
    },

    /**
     * #action
     */
    // One-shot single-feature isolate: replace the collection with just this
    // feature and apply immediately (the common "show only this one" case).
    soloFeature(featureId: string) {
      self.soloFeatureIds.replace([featureId])
      self.soloApplied = true
    },

    /**
     * #action
     */
    // Stop isolating and drop the whole collection.
    clearSolo() {
      self.soloFeatureIds.clear()
      self.soloApplied = false
    },

    /**
     * #action
     */
    // Hide a single feature (add to the exclusion set). Applies immediately.
    hideFeature(featureId: string) {
      if (!self.hiddenFeatureIds.includes(featureId)) {
        self.hiddenFeatureIds.push(featureId)
      }
    },

    /**
     * #action
     */
    // Bring back every hidden feature. Reset scroll so a re-shown feature
    // that first-fits to a top row (it re-enters layout as "new", with no
    // prior-y to hold its old row) lands in view instead of above a
    // scrolled-down viewport.
    showAllHidden() {
      self.hiddenFeatureIds.clear()
      self.setScrollTop(0)
    },
  }
}
