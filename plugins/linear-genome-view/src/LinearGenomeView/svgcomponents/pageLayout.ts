import { exportMargin } from '@jbrowse/core/svg/constants'
import {
  DEFAULT_FIGURE_TEXT_PT,
  parsePhysicalWidth,
  resolveFigureSize,
} from '@jbrowse/core/svg/figureSize'
import { awaitSvgReady, awaitSvgRenders } from '@jbrowse/core/svg/svgReady'
import { getSession, makeAbortError, max } from '@jbrowse/core/util'
import { leftAxisGutterWidth } from '@jbrowse/display-ui/axisPlacement'

import { layoutSvgTracks } from './renderViewTracks.ts'
import { lgvSvgLayoutOptions, trackLabelLeftOffset } from './util.ts'

import type { ExportSvgOptions } from '../types.ts'
import type { SvgExportTrack } from './renderViewTracks.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { PhysicalWidth } from '@jbrowse/core/svg/figureSize'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

export const MIN_PAGE_PLOT_PX = 200

const PAGE_EDGE_PX = 8

const PAGE_LAYOUT_PASSES = 2

type PageTrack = SvgExportTrack & { configuration: AnyConfigurationModel }

interface PageLayoutView {
  pinnedTracks: PageTrack[]
  unpinnedTracks: PageTrack[]
}

/**
 * What a page export is solved against: the exported view, for its session,
 * the linear genome views it stacks top to bottom, sharing one plot width,
 * the width of any key it draws beside the tracks' own, and a wait for data
 * that key reads which the tracks' own readiness does not cover.
 */
export interface PageLayoutSubject {
  node: IAnyStateTreeNode
  views: PageLayoutView[]
  legendWidth?: (
    theme: ThemeOptions | undefined,
    fontFamily: string | undefined,
  ) => number
  settled?: () => Promise<unknown>
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
 * keeps a thin edge, where one sized in px keeps `exportMargin` on every side.
 * The left margin also holds whatever part of a y axis the track-label gutter
 * `labelGutter` does not: an exported left axis stands its spine on the
 * plot's edge and grows its gutter out over the label gutter, then the margin.
 */
export function exportMargins(
  displays: SvgExportTrack['displays'],
  forPage: boolean,
  labelGutter = 0,
) {
  const edge = forPage ? PAGE_EDGE_PX : exportMargin
  const axisGutter = max(
    displays.map(display => leftAxisGutterWidth(display.axes ?? [])),
    0,
  )
  return {
    left: Math.max(edge, axisGutter - labelGutter),
    right: edge,
    bottom: edge,
  }
}

/**
 * The px a page export of `subject` spends beside its plot, as the tracks
 * stand now: its margins, track-label gutter and legend gutter, each key
 * measured at the height the export draws it. The legend lists what is
 * loaded, so a relayout can move it.
 */
function exportChromeWidth(subject: PageLayoutSubject, opts: ExportSvgOptions) {
  const { fontSize, textHeight, trackLabels } = lgvSvgLayoutOptions(opts)
  const session = getSession(subject.node)
  const theme = session.getActiveThemeOptions?.(opts.themeName)
  const tracks = subject.views.flatMap(renderedTracks)
  const displays = tracks.map(track => track.displays[0]!)
  const labelGutter = trackLabelLeftOffset({
    tracks,
    trackLabels,
    fontSize,
    fontFamily: opts.fontFamily,
    session,
  })
  const margins = exportMargins(displays, true, labelGutter)
  const legendGutter = max(
    [
      ...subject.views.map(
        view =>
          layoutSvgTracks({
            tracks: renderedTracks(view),
            theme,
            fontFamily: opts.fontFamily,
            textHeight,
            trackLabels,
          }).legendWidth,
      ),
      subject.legendWidth?.(theme, opts.fontFamily) ?? 0,
    ],
    0,
  )
  return margins.left + margins.right + labelGutter + legendGutter
}

function sizedPage(
  subject: PageLayoutSubject,
  opts: ExportSvgOptions,
  pageWidth: PhysicalWidth,
) {
  const textPt = opts.textSize ?? DEFAULT_FIGURE_TEXT_PT
  return {
    pageWidth,
    textPt,
    ...resolveFigureSize({
      pageWidth,
      textPt,
      labelPx: lgvSvgLayoutOptions(opts).fontSize,
      chromePx: exportChromeWidth(subject, opts),
    }),
  }
}

/**
 * How an export with a `pageWidth` lays `subject` out: the plot's px, the
 * scale the page draws the document at, and the px its rasters need.
 * Undefined for an export with no page width.
 */
export function pageLayout(subject: PageLayoutSubject, opts: ExportSvgOptions) {
  const pageWidth = parsePhysicalWidth(opts.pageWidth ?? '')
  return pageWidth ? sizedPage(subject, opts, pageWidth) : undefined
}

async function solvedPage(subject: PageLayoutSubject, opts: ExportSvgOptions) {
  if (parsePhysicalWidth(opts.pageWidth ?? '')) {
    await awaitSvgRenders([
      ...subject.views
        .flatMap(renderedTracks)
        .map(track => track.displays[0]!)
        .filter(isSvgExportable)
        .map(display => awaitSvgReady(display)),
      subject.settled?.(),
    ])
  }
  const page = pageLayout(subject, opts)
  if (page && page.plotPx < MIN_PAGE_PLOT_PX) {
    throw new Error(
      `A ${opts.pageWidth} figure at ${page.textPt} pt leaves the tracks ${Math.max(page.plotPx, 0)} px wide: widen the figure or lower the text size`,
    )
  }
  return page
}

/**
 * Lays `subject` out at its page's plot width and returns the page, undefined
 * for an export with no page width, which it leaves as it is. The page is
 * solved once the tracks have loaded, since a y axis and a key exist only
 * then, and again once they have reloaded at that width and `afterLayout` has
 * resolved: the refetch can move a key, an axis or a track's height, and the
 * page scales whatever document results to its physical width, text and
 * all. Where the chrome moved, the views are laid out once more. Throws for a
 * page too narrow for its text, and for an abort before a layout.
 */
export async function settledPageLayout(
  subject: PageLayoutSubject,
  opts: ExportSvgOptions,
  layOutAt: (width: number) => void,
  afterLayout: () => Promise<unknown> = async () => undefined,
) {
  let page = await solvedPage(subject, opts)
  let laidOutAt: number | undefined
  for (
    let pass = 0;
    page && page.plotPx !== laidOutAt && pass < PAGE_LAYOUT_PASSES;
    pass++
  ) {
    opts.signal?.throwIfAborted()
    laidOutAt = page.plotPx
    layOutAt(laidOutAt)
    await afterLayout()
    page = await solvedPage(subject, opts)
  }
  return page
}

interface ExportLayout {
  width: () => number
  layOutAt: (width: number) => void
}

interface ViewStack {
  setWidth: (width: number) => void
  views: {
    width: number
    setWidth: (width: number) => void
    settleCoarseBlocks: () => void
  }[]
}

/**
 * The layout of a view that stacks linear genome views on one shared width,
 * relaid as a window that wide would.
 */
export function stackLayout(stack: ViewStack): ExportLayout {
  return {
    width: () =>
      max(
        stack.views.map(view => view.width),
        0,
      ),
    layOutAt: width => {
      stack.setWidth(width)
      for (const view of stack.views) {
        view.setWidth(width)
        view.settleCoarseBlocks()
      }
    },
  }
}

let exportQueue: Promise<unknown> = Promise.resolve()

function untilAborted<T>(work: Promise<T>, signal: AbortSignal | undefined) {
  return signal
    ? new Promise<T>((resolve, reject) => {
        const abort = () => {
          reject(
            signal.reason instanceof Error ? signal.reason : makeAbortError(),
          )
        }
        if (signal.aborted) {
          abort()
        } else {
          signal.addEventListener('abort', abort, { once: true })
        }
        work.then(resolve, reject).finally(() => {
          signal.removeEventListener('abort', abort)
        })
      })
    : work
}

async function renderLaidOut(
  subject: PageLayoutSubject,
  opts: ExportSvgOptions,
  layout: ExportLayout,
  render: (opts: ExportSvgOptions) => Promise<string>,
) {
  opts.signal?.throwIfAborted()
  const width = layout.width()
  let laidOutAt = width
  // The on-screen tracks redraw at the export's width until it ends. A
  // hidden copy of the view would keep them still, but it needs a session
  // slot that autosave and undo skip, and new ids for the view, its tracks
  // and displays, since widgets find them by id.
  const layOutAt = (next: number) => {
    if (next !== laidOutAt) {
      laidOutAt = next
      layout.layOutAt(next)
    }
  }
  try {
    const page = await untilAborted(
      settledPageLayout(subject, opts, layOutAt),
      opts.signal,
    )
    if (!page) {
      layOutAt(opts.viewWidth ?? width)
    }
    return await untilAborted(
      render(page ? { ...opts, rasterScale: page.rasterScale } : opts),
      opts.signal,
    )
  } finally {
    layOutAt(width)
  }
}

/**
 * Renders `subject` laid out for the export, at its page's plot width or at
 * `viewWidth` when either is given, and puts the screen width back after.
 * Exports run one at a time, so the width each one restores is the screen's.
 * An aborted export rejects at once and frees the queue, leaving any render
 * it started to finish detached, unsaved.
 */
export function exportLaidOut(
  subject: PageLayoutSubject,
  opts: ExportSvgOptions,
  layout: ExportLayout,
  render: (opts: ExportSvgOptions) => Promise<string>,
) {
  const run = exportQueue.then(() =>
    renderLaidOut(subject, opts, layout, render),
  )
  exportQueue = run.catch(() => undefined)
  return run
}
