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
 * Right edge (px, viewport-relative) that a right-pinned overlay belongs at:
 * the last visible region's right edge, clamped to `width`. At whole-genome
 * zoom the regions can end before the track does, and an overlay pinned to the
 * full width parks out in the empty gutter reading as detached from the plot.
 * When content fills the track this is just `width`, so the common case is
 * unchanged.
 *
 * The rule lives here, beside {@link VisibleRegion}, because two callers need
 * it against two different widths: a view publishes it against its own
 * `trackWidthPx` as {@link RegionHost.contentRightEdgePx}, and an SVG export
 * against the export's canvas width.
 */
export function contentRightEdgePx(
  visibleRegions: { screenEndPx: number }[],
  width: number,
) {
  return Math.min(width, visibleRegions.at(-1)?.screenEndPx ?? width)
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
 * Each visible region widened by half a screen on either side, clamped to the
 * displayed region it came from, with whole-base ends: the regions a display
 * fetches over, so a pan of half a screen needs no refetch.
 *
 * Orientation rides along with the fetch region, not just with the render
 * blocks: canvas records it on the rpcDataMap entry
 * (`LayoutRegionData.reversed`) because label overhang packs toward lower bp in
 * a flipped region. A flip mutates `displayedRegions`, so
 * DisplayedRegionsChange refetches and the recorded flag can't go stale.
 */
export function bufferedVisibleRegionsOf({
  visibleRegions,
  displayedRegions,
  width,
  bpPerPx,
}: {
  visibleRegions: readonly Omit<
    VisibleRegion,
    'screenStartPx' | 'screenEndPx'
  >[]
  displayedRegions: readonly Region[]
  width: number
  bpPerPx: number
}): BufferedVisibleRegion[] {
  const bufferBp = Math.ceil(width * bpPerPx * 0.5)
  return visibleRegions.map(vr => {
    const dr = displayedRegions[vr.displayedRegionIndex]!
    return {
      region: {
        refName: vr.refName,
        start: Math.max(dr.start, Math.floor(vr.start) - bufferBp),
        end: Math.min(dr.end, Math.ceil(vr.end) + bufferBp),
        assemblyName: vr.assemblyName,
        reversed: vr.reversed,
      },
      displayedRegionIndex: vr.displayedRegionIndex,
    }
  })
}

/**
 * What a view fetches for `windows` laid end to end across its width, each a
 * window into the displayed region holding it, `windows` themselves where none
 * does: {@link bufferedVisibleRegionsOf} at any zoom, since its margin is half
 * the windows' bp. A static export fetching through this fetches what the view
 * would, each window keeping its own fields.
 */
export function windowFetchRegions<
  W extends { refName: string; start: number; end: number },
>(windows: readonly W[], displayedRegions: readonly W[] = windows) {
  const holding = windows.map(
    w =>
      displayedRegions.find(
        d => d.refName === w.refName && d.start <= w.start && d.end >= w.end,
      ) ?? w,
  )
  return bufferedVisibleRegionsOf({
    visibleRegions: windows.map((w, i) => ({
      ...w,
      assemblyName: '',
      displayedRegionIndex: i,
    })),
    displayedRegions: holding.map(d => ({ ...d, assemblyName: '' })),
    width: windows.reduce((sum, w) => sum + w.end - w.start, 0),
    bpPerPx: 1,
  }).map(({ region }, i) => ({
    ...windows[i]!,
    start: region.start,
    end: region.end,
  }))
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
  readonly totalWidthPxWithoutBorders: number
  readonly trackWidthPx: number
  readonly bpPerPx: number
  readonly coarseBpPerPx: number
  readonly offsetPx: number
  readonly displayedRegions: Region[]
  /**
   * The px each displayed region starts at, where a host lays gaps between
   * them (the circular view's strip); absent, they abut.
   */
  readonly displayedRegionOffsetsPx?: readonly number[]
  readonly staticBlocks: BlockSet
  readonly dynamicBlocks: BlockSet
  readonly settledDynamicBlocks: ContentBlock[]
  readonly visibleRegions: VisibleRegion[]
  readonly contentRightEdgePx: number
  readonly bufferedVisibleRegions: BufferedVisibleRegion[]
  readonly visibleBp: number
  readonly hasVisibleContent: boolean
}
