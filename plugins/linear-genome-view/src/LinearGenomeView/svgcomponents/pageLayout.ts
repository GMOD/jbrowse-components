import { exportMargin } from '@jbrowse/core/svg/constants'
import {
  DEFAULT_FIGURE_TEXT_PT,
  parsePhysicalWidth,
  resolveFigureSize,
} from '@jbrowse/core/svg/figureSize'
import { awaitSvgReady, awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
import { getSession, max } from '@jbrowse/core/util'
import { svgLegendGutterWidth } from '@jbrowse/display-kit/renderDisplaySvg'
import { leftAxisGutterWidth } from '@jbrowse/display-ui/axisPlacement'

import {
  getHeaderLayout,
  lgvSvgLayoutOptions,
  totalHeight,
  trackLabelLeftOffset,
} from './util.ts'

import type { ExportSvgOptions } from '../types.ts'
import type { SvgExportTrack } from './renderViewTracks.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { PhysicalWidth } from '@jbrowse/core/svg/figureSize'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { YAxis } from '@jbrowse/display-ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export const MIN_PAGE_PLOT_PX = 200

const PAGE_EDGE_PX = 8

type PageTrack = SvgExportTrack & { configuration: AnyConfigurationModel }

interface PageLayoutView {
  pinnedTracks: PageTrack[]
  unpinnedTracks: PageTrack[]
  effectiveShowCytobands?: boolean
}

function renderedTracks(view: PageLayoutView) {
  return [...view.pinnedTracks, ...view.unpinnedTracks].filter(
    track => !track.minimized && track.displays[0]?.renderSvg,
  )
}

function isSvgExportable<T extends object>(
  display: T,
): display is T & SvgExportable {
  return 'svgReady' in display && 'error' in display
}

/**
 * The px an export keeps clear around its tracks. A figure sized for a page
 * keeps its left margin only for a y axis drawn there and a thin edge
 * elsewhere, where one sized in px keeps `exportMargin` on every side.
 */
export function exportMargins(
  displays: { axes?: YAxis[] }[],
  forPage: boolean,
) {
  const axisGutter = max(
    displays.map(display => leftAxisGutterWidth(display.axes ?? [])),
    0,
  )
  return forPage
    ? {
        left: Math.max(PAGE_EDGE_PX, axisGutter),
        right: PAGE_EDGE_PX,
        bottom: PAGE_EDGE_PX,
      }
    : { left: exportMargin, right: exportMargin, bottom: exportMargin }
}

/**
 * What an export of `view` spends outside its plot, as the tracks stand now:
 * `widthPx` on its margins, track-label gutter and legend gutter, `heightPx`
 * on its header, tracks and bottom margin. The legend lists what is loaded and
 * some tracks grow with their data, so a relayout can move both.
 */
export function exportChrome(
  view: PageLayoutView & IAnyStateTreeNode,
  opts: ExportSvgOptions,
) {
  const { fontSize, textHeight, rulerHeight, trackLabels } =
    lgvSvgLayoutOptions(opts)
  const session = getSession(view)
  const theme = session.getActiveThemeOptions?.(opts.themeName)
  const tracks = renderedTracks(view)
  const displays = tracks.map(track => track.displays[0]!)
  const margins = exportMargins(
    displays,
    parsePhysicalWidth(opts.pageWidth ?? '') !== undefined,
  )
  const labelGutter = trackLabelLeftOffset({
    tracks,
    trackLabels,
    fontSize,
    fontFamily: opts.fontFamily,
    session,
  })
  const legendGutter = max(
    displays.map(display =>
      display.regionTooLarge
        ? 0
        : svgLegendGutterWidth(display, theme, Infinity),
    ),
    0,
  )
  return {
    widthPx: margins.left + margins.right + labelGutter + legendGutter,
    heightPx:
      getHeaderLayout({
        fontSize,
        showCytobands: !!view.effectiveShowCytobands,
        rulerHeight,
      }).tracksTop +
      totalHeight(tracks, trackLabels, textHeight) +
      margins.bottom,
  }
}

function sizedPage(
  view: PageLayoutView & IAnyStateTreeNode,
  opts: ExportSvgOptions,
  pageWidth: PhysicalWidth,
) {
  const textPt = opts.textSize ?? DEFAULT_FIGURE_TEXT_PT
  const chrome = exportChrome(view, opts)
  const size = resolveFigureSize({
    pageWidth,
    textPt,
    labelPx: lgvSvgLayoutOptions(opts).fontSize,
    chromePx: chrome.widthPx,
  })
  return {
    pageWidth,
    textPt,
    ...size,
    pageHeight: +(
      (pageWidth.value * chrome.heightPx) /
      size.documentPx
    ).toFixed(pageWidth.unit === 'mm' ? 0 : 1),
  }
}

/**
 * How an export with a `pageWidth` lays `view` out: the plot's px, the scale
 * the page draws the document at, the px its rasters need, and the height the
 * page comes to in the width's unit. Undefined for an export with no page
 * width.
 */
export function pageLayout(
  view: PageLayoutView & IAnyStateTreeNode,
  opts: ExportSvgOptions,
) {
  const pageWidth = parsePhysicalWidth(opts.pageWidth ?? '')
  return pageWidth ? sizedPage(view, opts, pageWidth) : undefined
}

/**
 * {@link pageLayout} once the tracks have loaded: a y axis and a key exist
 * only then, and the page is solved against the room they take.
 */
export async function settledPageLayout(
  view: PageLayoutView & IAnyStateTreeNode,
  opts: ExportSvgOptions,
) {
  if (parsePhysicalWidth(opts.pageWidth ?? '')) {
    await awaitSvgRenders(
      renderedTracks(view)
        .map(track => track.displays[0]!)
        .filter(isSvgExportable)
        .map(display => awaitSvgReady(display)),
    )
  }
  return pageLayout(view, opts)
}
