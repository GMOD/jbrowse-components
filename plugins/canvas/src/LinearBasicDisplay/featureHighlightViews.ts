import { canonicalizeViewRefName } from '@jbrowse/core/util'
import { sameOptionalStrings } from '@jbrowse/core/util/sameStrings'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  resolveFeatureHighlights,
  warnUnresolvedHighlights,
} from './featureHighlight.ts'

import type {
  FeatureHighlight,
  FeatureHighlightModel,
  HighlightTarget,
  HighlightableRegion,
  ResolvedHighlights,
} from './featureHighlight.ts'
import type { Region } from '@jbrowse/core/util'
import type { IMSTArray, IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FeatureHighlightHost extends IStateTreeNode {
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
  rpcDataMap: ReadonlyMap<number, HighlightableRegion>
  loadedRegions: ReadonlyMap<number, Region>
  pinnedFeatureIds: readonly string[]
  pinnedFeatureIdSet: ReadonlySet<string>
}

export interface FeatureHoverHost {
  featureIdUnderMouse: string | undefined
  subfeatureIdUnderMouse: string | undefined
  mouseoverExtraInformation: string[] | undefined
  resolvedHighlights: ResolvedHighlights
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
}

export function featureHighlightViews(self: FeatureHighlightHost) {
  return {
    /**
     * #getter
     */
    // The regions carry the assembly's canonical refName and a hand-authored
    // spec carries whatever the author typed, an alias as often as not;
    // unnormalized, `chr12` against `12` boxes nothing and says nothing.
    get canonicalFeatureHighlights(): FeatureHighlight[] {
      return self.featureHighlights.map(h => ({
        ...getSnapshot(h),
        refName: canonicalizeViewRefName(self, h.refName),
      }))
    },

    /**
     * #getter
     */
    // Against the raw fetched data rather than the layout, so it can feed
    // pinning without a layout cycle.
    get resolvedHighlights(): ResolvedHighlights {
      // Index-aligned with `self.featureHighlights`, which `boxedBy` indexes.
      const highlights = this.canonicalFeatureHighlights
      const resolved = resolveFeatureHighlights(
        self.rpcDataMap.values(),
        highlights,
      )
      // Handed the loaded spans, not just whether data exists: a highlight
      // resolves to nothing whenever the user pans off its locus, and gating
      // on data alone blamed the spec for that.
      warnUnresolvedHighlights(highlights, resolved, [
        ...self.loadedRegions.values(),
      ])
      return resolved
    },

    /**
     * #getter
     */
    get highlightedFeatureIdSet(): ReadonlySet<string> {
      return this.resolvedHighlights.box
    },

    /**
     * #getter
     */
    // Returns the pinned set by reference when nothing is highlighted, so the
    // layout cache's reference compare stays cheap.
    get layoutPinnedFeatureIdSet(): ReadonlySet<string> {
      const highlighted = this.resolvedHighlights.pin
      if (highlighted.size === 0) {
        return self.pinnedFeatureIdSet
      }
      return new Set([...self.pinnedFeatureIds, ...highlighted])
    },

    /**
     * #getter
     */
    // Counts the specs, not the resolved boxes: a highlight the user panned
    // away from resolves to nothing and is exactly what the track-level clear
    // reaches.
    get featureHighlightCount() {
      return self.featureHighlights.length
    },
  }
}

export function featureHighlightActions(self: FeatureHoverHost) {
  return {
    /**
     * #action
     */
    setHover(
      featureId: string | undefined,
      subfeatureId: string | undefined,
      tooltip: string[] | undefined,
    ) {
      self.featureIdUnderMouse = featureId
      self.subfeatureIdUnderMouse = subfeatureId
      // The tooltip is a fresh array on every hit, and without the comparison
      // a resting cursor re-rendered `FeatureTooltip` on every mousemove.
      if (!sameOptionalStrings(self.mouseoverExtraInformation, tooltip)) {
        self.mouseoverExtraInformation = tooltip
      }
    },

    /**
     * #action
     */
    clearHover() {
      self.featureIdUnderMouse = undefined
      self.subfeatureIdUnderMouse = undefined
      self.mouseoverExtraInformation = undefined
    },

    /**
     * #action
     */
    setFeatureHighlights(highlights: FeatureHighlight[]) {
      // clear + push rather than assignment: through a structural host `cast`
      // has no model property to infer from, and `push` carries MST's
      // creation-type overload.
      self.featureHighlights.clear()
      self.featureHighlights.push(...highlights)
    },

    /**
     * #action
     */
    // Manual highlights accumulate, deduped on the stored featureId so a gene
    // never collides with a separately highlighted transcript sharing its
    // span.
    addFeatureHighlightForItem(target: HighlightTarget, refName: string) {
      const already = self.featureHighlights.some(
        h => h.featureId === target.featureId,
      )
      if (!already) {
        self.featureHighlights.push({
          refName,
          start: target.startBp,
          end: target.endBp,
          name: target.name,
          featureId: target.featureId,
        })
      }
    },

    /**
     * #action
     */
    // Asks the same resolution the overlay draws from rather than re-matching
    // the stored signature: a gene-wide highlight fuzzily matches an isoform
    // sharing its span, and re-matching took the gene's highlight along with
    // the isoform's.
    removeFeatureHighlightsForId(featureId: string) {
      const { boxedBy } = self.resolvedHighlights
      this.setFeatureHighlights(
        self.featureHighlights
          .filter((_h, i) => !boxedBy[i]?.has(featureId))
          .map(h => getSnapshot(h)),
      )
    },

    /**
     * #action
     */
    clearFeatureHighlights() {
      self.featureHighlights.clear()
    },
  }
}
