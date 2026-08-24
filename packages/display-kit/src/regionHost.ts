import type { AbstractViewModel, Region } from '@jbrowse/core/util'
import type { BlockSet, ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * One on-screen slice of a displayed region, in the viewport's own terms: the
 * bp span that is actually visible, which displayed region it came from, and
 * where it lands on screen.
 */
export interface VisibleRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
  reversed?: boolean
  displayedRegionIndex: number
  screenStartPx: number
  screenEndPx: number
}

/**
 * A visible region widened by the host's fetch buffer and clamped to the
 * displayed region it came from. The shape a per-region fetch is issued over.
 */
export interface BufferedVisibleRegion {
  region: Region & { reversed?: boolean }
  displayedRegionIndex: number
}

/**
 * The view that contains a display, as the display layer sees it: a view, plus
 * what the layer reads off it and nothing else. That is the whole of the
 * relationship: which regions are displayed, which slice of them is on screen,
 * and the viewport's scale and geometry.
 *
 * Duck-typed rather than the linear genome view's own model type so that the
 * display layer sits below the view plugin. The LGV satisfies it; so could any
 * other model that lays displays out along regions.
 */
export interface RegionHost extends AbstractViewModel, IStateTreeNode {
  readonly initialized: boolean
  readonly width: number
  readonly totalWidthPx: number
  readonly trackWidthPx: number
  readonly bpPerPx: number
  readonly coarseBpPerPx: number
  readonly offsetPx: number
  readonly displayedRegions: Region[]
  readonly staticBlocks: BlockSet
  readonly dynamicBlocks: BlockSet
  readonly settledDynamicBlocks: ContentBlock[]
  readonly visibleRegions: VisibleRegion[]
  readonly bufferedVisibleRegions: BufferedVisibleRegion[]
  readonly visibleBp: number
  readonly hasVisibleContent: boolean
}
