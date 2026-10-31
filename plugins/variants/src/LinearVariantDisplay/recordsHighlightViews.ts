import { canonicalizeViewRefName } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  createMembershipMemo,
  resolveFeatureHighlights,
} from '@jbrowse/plugin-features/band'
import { makeBpMapper, spanRect } from '@jbrowse/render-core/canvas2dUtils'

import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IMSTArray, IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  FeatureDataResult,
  FeatureHighlightModel,
  LayoutRegionData,
  ResolvedHighlights,
} from '@jbrowse/plugin-features/band'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

interface RecordBox {
  startBp: number
  endBp: number
  topPx: number
  bottomPx: number
}

interface RecordInkHost {
  host: {
    visibleRegions: readonly (BpRegionBounds & {
      displayedRegionIndex: number
    })[]
  }
  recordsScrollTop: number
}

/**
 * The box a record drew in the band, in the display's px: the hover box and
 * a highlight light the same rectangle.
 */
export function recordInk(
  self: RecordInkHost,
  displayedRegionIndex: number,
  item: RecordBox,
): HighlightRect[] {
  const region = self.host.visibleRegions.find(
    r => r.displayedRegionIndex === displayedRegionIndex,
  )
  return region
    ? [
        {
          ...spanRect(makeBpMapper(region), item.startBp, item.endBp, 1),
          top: item.topPx - self.recordsScrollTop,
          height: item.bottomPx - item.topPx,
        },
      ]
    : []
}

interface RecordsHighlightHost extends IStateTreeNode, RecordInkHost {
  featureHighlights: IMSTArray<typeof FeatureHighlightModel>
  recordsRenderDataMap: ReadonlyMap<number, LayoutRegionData>
  recordsLaidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  view: { displayedRegions: readonly { refName: string }[] }
}

/**
 * The records a search hit, a right-click or a session names, resolved as a
 * feature track resolves them, over the band's records.
 */
export function recordsHighlightViews(self: RecordsHighlightHost) {
  const sameBoxed = createMembershipMemo()
  return {
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
      const ids = this.highlightedFeatureIdSet
      return ids.size === 0
        ? []
        : [...self.recordsLaidOutDataMap].flatMap(([index, data]) =>
            data.flatbushItems
              .filter(item => ids.has(item.featureId))
              .flatMap(item => recordInk(self, index, item)),
          )
    },
  }
}
