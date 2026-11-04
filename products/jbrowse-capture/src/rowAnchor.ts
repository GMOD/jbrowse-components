import { parseAnnotationLocus } from './annotationOverlay.ts'

import type { AnnotationAnchor, AnnotationRegion } from './annotationOverlay.ts'
import type { ViewportRect } from './graphAnchor.ts'
import type { Page } from 'puppeteer'

// Where a row display drew a row it names, in viewport CSS px: the strip the
// row sits in, across the track, or across `region` where one is given. A
// fraction of the track's height moves whenever a band is added above the
// rows, and nothing fails: the callout lands on another row. The display
// already places its rows (`sources` from `rowsTopOffset`, a row each
// `effectiveRowHeight`, scrolled by `scrollTop` inside `scrollViewportHeight`),
// so ask it.
//
// A name matches a drawn row by its name or the label its sidebar shows, and a
// band of rows by its label or key. It is a miss unless exactly one matches,
// and unless some of it is inside the rows viewport: a row narrowed away, in a
// hidden band or scrolled out of sight is not drawn, and the miss is undefined
// so the caller fails the spec by name.
//
// Puppeteer serializes this into the page, so it closes over nothing.
export function rowRectInPage(
  viewPath: number[],
  trackId: string,
  name: string,
  region: AnnotationRegion | undefined,
) {
  interface Row {
    name: string
    label?: string
  }
  interface Band {
    key: string
    label: string
    start: number
    end: number
  }
  interface RowDisplay {
    sources: Row[]
    bandedSources: Row[]
    rowBands: readonly Band[]
    rowsTopOffset: number
    effectiveRowHeight: number
    scrollTop: number
    scrollViewportHeight: number
  }
  interface View {
    id: string
    views?: View[]
    assemblyNames?: string[]
    tracks?: {
      configuration?: { trackId?: string }
      displays?: Partial<RowDisplay>[]
    }[]
    getHighlightCoords?: (region: {
      assemblyName?: string
      refName: string
      start: number
      end: number
    }) => { left: number; width: number } | undefined
  }
  const isRowDisplay = (d: Partial<RowDisplay>): d is RowDisplay =>
    Array.isArray(d.sources) &&
    Array.isArray(d.bandedSources) &&
    Array.isArray(d.rowBands) &&
    typeof d.rowsTopOffset === 'number' &&
    typeof d.effectiveRowHeight === 'number' &&
    typeof d.scrollTop === 'number' &&
    typeof d.scrollViewportHeight === 'number'

  function namedSpans(display: RowDisplay) {
    const { sources, bandedSources, rowBands } = display
    const rows = sources.flatMap((row, i) =>
      row.name === name || row.label === name ? [{ start: i, end: i + 1 }] : [],
    )
    const bands = rowBands
      .filter(band => band.label === name || band.key === name)
      .flatMap(band => {
        const members = new Set(
          bandedSources.slice(band.start, band.end).map(row => row.name),
        )
        const drawn = sources.flatMap((row, i) =>
          members.has(row.name) ? [i] : [],
        )
        return drawn.length
          ? [{ start: Math.min(...drawn), end: Math.max(...drawn) + 1 }]
          : []
      })
    return [...rows, ...bands]
  }

  function stripIn(display: RowDisplay, view: View, container: Element) {
    const spans = namedSpans(display)
    const span = spans.length === 1 ? spans[0] : undefined
    const { rowsTopOffset, effectiveRowHeight, scrollTop } = display
    const r = container.getBoundingClientRect()
    // 0 is a display that does not scroll its rows (a multi-row wiggle)
    const shownBottom =
      display.scrollViewportHeight > 0
        ? Math.min(rowsTopOffset + display.scrollViewportHeight, r.height)
        : r.height
    const top = span
      ? Math.max(
          rowsTopOffset,
          rowsTopOffset + span.start * effectiveRowHeight - scrollTop,
        )
      : 0
    const bottom = span
      ? Math.min(
          shownBottom,
          rowsTopOffset + span.end * effectiveRowHeight - scrollTop,
        )
      : 0
    const x = region
      ? view.getHighlightCoords?.({
          ...region,
          assemblyName: view.assemblyNames?.[0],
        })
      : { left: 0, width: r.width }
    return x && bottom > top
      ? {
          left: r.left + x.left,
          top: r.top + top,
          width: !region || region.end > region.start ? x.width : 0,
          height: bottom - top,
        }
      : undefined
  }

  let view = (window as unknown as { JBrowseSession?: View }).JBrowseSession
  for (const i of viewPath) {
    view = view?.views?.[i]
  }
  const display = view?.tracks
    ?.find(t => t.configuration?.trackId === trackId)
    ?.displays?.find(isRowDisplay)
  const container =
    view &&
    document.querySelector(
      `[data-testid="trackRenderingContainer-${CSS.escape(view.id)}-${CSS.escape(trackId)}"]`,
    )
  return view && display && container
    ? stripIn(display, view, container)
    : undefined
}

async function rowBox(page: Page, anchor: AnnotationAnchor, wrap: boolean) {
  return anchor.row === undefined || anchor.trackId === undefined
    ? undefined
    : page.evaluate(
        rowRectInPage,
        Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0],
        anchor.trackId,
        anchor.row,
        anchor.loc ? parseAnnotationLocus(anchor.loc, wrap) : undefined,
      )
}

// The row's strip, or with `fracY` the line through it at that fraction of its
// height (0 its top edge). `wrap` is what a one-base `loc` means: the base's
// column for a box, the point before it for anything pointing at it.
export async function rowRect(
  page: Page,
  anchor: AnnotationAnchor,
  wrap: boolean,
): Promise<ViewportRect | undefined> {
  const box = await rowBox(page, anchor, wrap)
  return box && anchor.fracY !== undefined
    ? { ...box, top: box.top + anchor.fracY * box.height, height: 0 }
    : box
}
