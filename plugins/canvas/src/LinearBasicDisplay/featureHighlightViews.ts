import { canonicalizeViewRefName } from '@jbrowse/core/util'
import { sameOptionalStrings } from '@jbrowse/core/util/sameStrings'

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

/**
 * What resolving and marking highlights reads off the display. Structural
 * rather than the model type, so this stays a plain layer the display installs
 * (ADR-041) rather than a mixin composed into an already-deep chain.
 */
export interface FeatureHighlightHost extends IStateTreeNode {
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
  rpcDataMap: ReadonlyMap<number, HighlightableRegion>
  loadedRegions: ReadonlyMap<number, Region>
  pinnedFeatureIds: readonly string[]
  pinnedFeatureIdSet: ReadonlySet<string>
}

/** The hover and the tooltip beside it. */
export interface FeatureHoverHost {
  featureIdUnderMouse: string | null
  subfeatureIdUnderMouse: string | null
  mouseoverExtraInformation: string[] | undefined
  resolvedHighlights: ResolvedHighlights
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
}

export function featureHighlightViews(self: FeatureHighlightHost) {
  return {
    /**
     * #getter
     */
    // The highlight list with every refName run through
    // canonicalizeViewRefName — the one normalization layer, which resolves
    // aliases and casing together.
    //
    // The matchers compare refName text directly, and the regions they
    // compare it against carry the assembly's CANONICAL name. A highlight
    // does not: the right-click path copies the region's own refName and is
    // therefore already canonical, but a hand-authored session spec carries
    // whatever the author typed — which is whatever the location box showed
    // them, i.e. an alias as often as not. Unnormalized, `chr12` against an
    // assembly canonicalized on `12` boxes nothing, says nothing, and is
    // indistinguishable from the feature not being there. Worse, it depends
    // on the assembly: the same spec key works on one hg38 config and
    // silently does nothing on another.
    //
    // The search bridge (searchResultHighlight.ts) canonicalizes at its own
    // producer for exactly this reason. Doing it here covers the provenance
    // that has no producer to fix it.
    get canonicalFeatureHighlights(): FeatureHighlight[] {
      return self.featureHighlights.map(h => ({
        refName: canonicalizeViewRefName(self, h.refName),
        start: h.start,
        end: h.end,
        name: h.name,
        featureId: h.featureId,
      }))
    },

    /**
     * #getter
     */
    // Resolve declarative highlights against the RAW fetched data (rpcDataMap)
    // rather than the laid-out data — deliberately pre-layout, so it can feed
    // both boxing and pinning without a layout→layout cycle (coords/name live
    // on the raw items, no row/topPx needed). See resolveFeatureHighlights for
    // the box/pin/boxedBy resolution rules.
    get resolvedHighlights(): ResolvedHighlights {
      // index-aligned with self.featureHighlights, so `boxedBy` attribution
      // still indexes the stored list (removeFeatureHighlightsForId).
      const highlights = this.canonicalFeatureHighlights
      const resolved = resolveFeatureHighlights(
        self.rpcDataMap.values(),
        highlights,
      )
      // exact-span matching makes a mistyped coordinate draw nothing at all;
      // say so once rather than leaving it silent (warnUnresolvedHighlights
      // dedupes, so recomputing this getter doesn't spam). It is handed the
      // loaded region SPANS, not just "is there data": a highlight resolves
      // to nothing whenever the user pans or navigates off its locus, and
      // gating on data-existence alone blamed the spec for that.
      warnUnresolvedHighlights(highlights, resolved, [
        ...self.loadedRegions.values(),
      ])
      return resolved
    },

    /**
     * #getter
     */
    // The render-item ids resolved from a search highlight (features and/or
    // subfeatures), for the overlay and SVG export to box. Resolved pre-layout
    // against the raw fetched data (see resolvedHighlights), so it stays stable
    // across pan/zoom; the overlay's addFeatureBox no-ops any id not currently
    // laid out, so no on-screen intersection is needed here (same as
    // soloFeatureIdSet).
    get highlightedFeatureIdSet(): ReadonlySet<string> {
      return this.resolvedHighlights.box
    },

    /**
     * #getter
     */
    // Rows the packer pins to the top: the user's explicit pins PLUS any
    // searched highlight, so a searched feature lands in a top row instead of
    // being buried (or clipped) deep in a dense track. Returns the pinned set
    // by reference when nothing is highlighted, keeping the layout cache's
    // reference compare cheap in the common case.
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
    // How many highlight boxes are drawn, for the "Clear N highlights"
    // recovery item. Counts the specs, not the resolved boxes: a highlight
    // the user has panned away from resolves to nothing but is exactly the
    // one the track-level clear exists to reach.
    get featureHighlightCount() {
      return self.featureHighlights.length
    },
  }
}

/**
 * The highlight set's edits and the hover writes beside them.
 */
export function featureHighlightActions(self: FeatureHoverHost) {
  return {
    /**
     * #action
     */
    setHover(
      featureId: string | null,
      subfeatureId: string | null,
      tooltip: string[] | undefined,
    ) {
      self.featureIdUnderMouse = featureId
      self.subfeatureIdUnderMouse = subfeatureId
      // The two ids are primitives, so MobX already drops a rewrite with the
      // same value; the tooltip is a fresh array on every hit, and without the
      // comparison a cursor resting on one feature re-rendered `FeatureTooltip`
      // on every raw mousemove with identical rows.
      if (!sameOptionalStrings(self.mouseoverExtraInformation, tooltip)) {
        self.mouseoverExtraInformation = tooltip
      }
    },

    /**
     * #action
     */
    clearHover() {
      self.featureIdUnderMouse = null
      self.subfeatureIdUnderMouse = null
      self.mouseoverExtraInformation = undefined
    },

    /**
     * #action
     */
    // Replace the highlight set (a search selecting a new gene supersedes the
    // previous highlight rather than accumulating). Resolved lazily against
    // rendered features via highlightedFeatureIdSet.
    setFeatureHighlights(highlights: FeatureHighlight[]) {
      // clear + push rather than an assignment: the array is reached through a
      // structural host type here, where `cast` has no model property to infer
      // its target from. `push` carries MST's creation-type overload, so a
      // plain FeatureHighlight is accepted as the snapshot it is.
      self.featureHighlights.clear()
      self.featureHighlights.push(...highlights)
    },

    /**
     * #action
     */
    // Additively highlight one rendered feature (right-click "Highlight
    // feature"). Unlike setFeatureHighlights, which replaces the set so a new
    // search supersedes the old one, manual highlights accumulate so a user
    // can mark several features at once; skip the add if this exact feature
    // (by id) is already highlighted (idempotent re-highlight). Dedupe on the
    // stored featureId, so re-highlighting a gene never collides with a
    // separately highlighted transcript that shares its span.
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
    // Drop the highlights that actually box this rendered id, asking the same
    // resolution the overlay draws from — so "Remove highlight" removes
    // exactly the boxes the user is looking at, and the menu's label can't
    // disagree with what its click does.
    //
    // Deliberately NOT a re-match against the stored signature. The matchers
    // are heuristic by necessity (trix records no uniqueId, so a highlight is
    // pinned by span + a label that may be a custom/indexed string), and a
    // heuristic match is a fine basis for best-effort boxing but a bad one
    // for deleting: a gene-wide highlight fuzzily matches an isoform sharing
    // its span, so removing that isoform's highlight used to silently take
    // the gene's with it. Attribution still clears a search-drifted
    // highlight — resolution matched it by span in the first place.
    removeFeatureHighlightsForId(featureId: string) {
      const { boxedBy } = self.resolvedHighlights
      this.setFeatureHighlights(
        self.featureHighlights
          .filter((_h, i) => !boxedBy[i]?.has(featureId))
          .map(h => ({
            refName: h.refName,
            start: h.start,
            end: h.end,
            name: h.name,
            featureId: h.featureId,
          })),
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
