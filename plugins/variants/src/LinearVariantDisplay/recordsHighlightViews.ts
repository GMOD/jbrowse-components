import {
  canonicalizeViewRefName,
  getSession,
  isFeature,
} from '@jbrowse/core/util'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import {
  buildRegionInstanceIndex,
  createMembershipMemo,
  drawnLabelTexts,
  featureHighlightInk,
  resolveFeatureHighlights,
} from '@jbrowse/plugin-features/band'

import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IMSTArray, IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  FeatureDataResult,
  FeatureHighlightModel,
  FeatureInkHost,
  LayoutRegionData,
  RegionInstanceIndex,
  ResolvedHighlights,
} from '@jbrowse/plugin-features/band'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface RecordsHighlightHost extends IStateTreeNode {
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
  recordsRenderDataMap: ReadonlyMap<number, LayoutRegionData>
  recordsLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  renderBlocks: readonly RenderBlock[]
  canvasWidthPx: number
  topBands: { recordsHeight: number }
  recordsScrollTop: number
  recordsRenderedLabels: { showLabels: boolean; showDescriptions: boolean }
  recordsFontSize: number
  view: { displayedRegions: readonly { refName: string }[] }
}

/**
 * The records a search hit, a right-click or a session names, resolved as a
 * feature track resolves them, over the band's records; each lit as a
 * feature track lights one, over its glyph and its labels.
 */
export function recordsHighlightViews(self: RecordsHighlightHost) {
  const sameBoxed = createMembershipMemo()
  return {
    /**
     * #getter
     * The band's record ids to the primitives they painted, per region,
     * built when a hover or a highlight first asks.
     */
    get recordsRegionInstanceIndexes(): ReadonlyMap<
      number,
      RegionInstanceIndex
    > {
      const map = new Map<number, RegionInstanceIndex>()
      for (const [idx, data] of self.recordsLaidOutDataMap) {
        map.set(idx, buildRegionInstanceIndex(data))
      }
      return map
    },
    /**
     * #getter
     * The band as plugin-features's ink reads a feature track: its stack,
     * its scroll and height, and the labels it drew.
     */
    get recordsInkHost(): FeatureInkHost {
      const { showLabels, showDescriptions } = self.recordsRenderedLabels
      return {
        renderBlocks: self.renderBlocks,
        renderDataMap: self.recordsLaidOutDataMap,
        renderState: {
          scrollY: self.recordsScrollTop,
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.topBands.recordsHeight,
          outlineColor: 0,
        },
        regionInstanceIndexes: this.recordsRegionInstanceIndexes,
        renderedShowLabels: showLabels,
        renderedShowDescriptions: showDescriptions,
        renderedShowSubfeatureLabels: false,
        renderedLabelFontSize: self.recordsFontSize,
      }
    },
    /**
     * #method
     * One box per region per record, over its glyph and the labels the
     * band drew for it, in the display's px, as LinearBasicDisplay boxes a
     * feature.
     */
    recordsInk(featureIds: Iterable<string>): HighlightRect[] {
      return featureHighlightInk(this.recordsInkHost, featureIds)
    },
    /**
     * #method
     * The text of every label the band drew for a record, which its hover
     * tooltip leaves out, as a feature track's does.
     */
    recordsDrawnLabelTexts(featureId: string) {
      return drawnLabelTexts(this.recordsInkHost, [featureId])
    },
    /**
     * #getter
     * The session's selected feature's id: a record a click opened, off the
     * band or a cell.
     */
    get selectedFeatureId() {
      const selection = isAlive(self) ? getSession(self).selection : undefined
      return isFeature(selection) ? selection.id() : undefined
    },
    /**
     * #getter
     * `HighlightHost`'s selection: the selected record's box on the band.
     */
    get selectionInk(): HighlightRect[] {
      const id = this.selectedFeatureId
      return this.recordsInk(id === undefined ? [] : [id])
    },
    /**
     * #getter
     * Which band records each stored highlight boxes. A record the band
     * does not draw (an SNV over rows) boxes nothing.
     */
    get resolvedHighlights(): ResolvedHighlights {
      const { displayedRegions } = self.view
      return resolveFeatureHighlights(
        [...self.recordsRenderDataMap].flatMap(([index, data]) => {
          const region = displayedRegions[index]
          return region ? [{ ...data, refName: region.refName }] : []
        }),
        self.featureHighlights.map(h => ({
          ...getSnapshot(h),
          refName: canonicalizeViewRefName(self, h.refName),
        })),
      )
    },
    /**
     * #getter
     * The band records any highlight boxes, what the Highlight row reads.
     */
    get highlightedFeatureIdSet(): ReadonlySet<string> {
      return sameBoxed(this.resolvedHighlights.box)
    },
    /**
     * #getter
     * `HighlightHost`'s pinned boxes: each highlighted record's box on the
     * band, as the hover box lights it.
     */
    get pinnedInk(): HighlightRect[] {
      return this.recordsInk(this.highlightedFeatureIdSet)
    },
  }
}
