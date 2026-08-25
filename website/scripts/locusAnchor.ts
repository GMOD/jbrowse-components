import { VIEW_SCOPE_TESTIDS } from './selectorAnchor.ts'

import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// Where a linear genome view drew a genomic coordinate, in viewport CSS px.
//
// The sibling of graphAnchor's node resolution, and for the same reason: a
// canvas has no element per feature, so a click on one was a hand-measured
// viewport coordinate — which holds only while the view's width, its locus and
// the track's layout all stay exactly as they were the day the number was
// written. `alignments_sort_by_base` is what that costs. Its right-click was
// computed for a 107bp window; the spec's locus is now 31bp, so x=550 stopped
// landing on the SNP it names and landed between two mismatch columns instead.
// The context menu then offered no "SNP/Mismatch" item, the cascade timed out,
// and — because which read sits under a fixed y depends on how the pileup packed
// that run — it did so intermittently, which is a much worse failure than doing
// it every time.
//
// The view already knows where it painted a locus: `getHighlightCoords` is the
// same call the highlight/bookmark overlays and the SVG export use, and it
// resolves the refName through the view's own assembly (so `chr1` works against
// an assembly whose canonical name is `1`) and subtracts scroll. The annotation
// overlay anchors its callouts through it too — this makes the same coordinate
// available to a click, so a figure's action and its callout can name the same
// locus instead of two numbers that have to be kept in sync by hand.
//
// `band` names a strip inside the view — the scalebar, say — to take the y
// from, leaving the x on the locus. It is what lets a rubberband drag name two
// loci instead of four measured pixels.
//
// Returns undefined when the view, the track, the band or the locus doesn't
// resolve, so the caller fails the spec by name rather than clicking (0,0).
export async function locusPoint(page: Page, anchor: AnnotationAnchor) {
  const path = Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0]
  const region = parseLocus(anchor.locus ?? '')
  const point = await page.evaluate(
    (
      viewPath: number[],
      trackId: string | undefined,
      bandSelector: string | undefined,
      want: { refName: string; start: number; end: number },
      fracY: number,
      scopeTestids: string[],
    ) => {
      interface AnchorableView {
        id: string
        views?: AnchorableView[]
        assemblyNames?: string[]
        trackRefs?: Record<string, Element | undefined>
        getHighlightCoords?: (region: {
          assemblyName?: string
          refName: string
          start: number
          end: number
        }) => { left: number; width: number } | undefined
      }
      let view = (window as unknown as { JBrowseSession?: AnchorableView })
        .JBrowseSession
      for (const i of viewPath) {
        view = view?.views?.[i]
      }
      if (!view) {
        return undefined
      }
      // Either box the view can carry, since a nested one has only the second
      // -- see VIEW_SCOPE_TESTIDS. A `band` on a synteny row resolved through
      // the whole document before this, which is the FIRST row's ruler
      // whichever row was asked for.
      const inView = (selector: string) =>
        document
          .querySelector(
            scopeTestids
              .map(t => `[data-testid="${t}-${CSS.escape(view.id)}"]`)
              .join(', '),
          )
          ?.querySelector(selector)
      // the track's rendering container when the spec names one (a click has to
      // land in the right track), else the whole tracks area
      const el = trackId
        ? view.trackRefs?.[trackId]
        : inView('[data-testid="tracksContainer"]')
      // `band` moves the y only. Every strip in a linear view is laid out over
      // the same x-range as the tracks, so a locus resolved against the tracks
      // container is already at the right x for the scalebar above them — and
      // resolving x against the strip too would assume its content box starts
      // where the tracks' does, which is a second thing to be right about.
      const bandEl = bandSelector ? inView(bandSelector) : el
      const coords = view.getHighlightCoords?.({
        ...want,
        assemblyName: view.assemblyNames?.[0],
      })
      if (!el || !bandEl || !coords) {
        return undefined
      }
      const r = el.getBoundingClientRect()
      const band = bandEl.getBoundingClientRect()
      return {
        // the middle of the locus: a one-base region is a ~35px column at 31bp
        // across, and its edge is a coin flip between two bases
        x: r.left + coords.left + coords.width / 2,
        y: band.top + fracY * band.height,
      }
    },
    path,
    anchor.track,
    anchor.band,
    region,
    anchor.fracY ?? 0.5,
    VIEW_SCOPE_TESTIDS,
  )
  return point
    ? { x: point.x + (anchor.dx ?? 0), y: point.y + (anchor.dy ?? 0) }
    : undefined
}

// `ctgA:14,481` or `ctgA:14481-14490`, to a half-open interval. A single
// coordinate is the one base at it, so the point lands on that base's column
// rather than on a zero-width edge between two of them.
//
// Deliberately not shared with the annotation overlay's parseAnnotationLocus,
// which returns a zero-width region for a point locus on purpose (a callout
// centres on it). A click wants the base.
function parseLocus(locus: string) {
  const m = /^(.+):(\d+)(?:-(\d+))?$/.exec(locus.replaceAll(/[\s,]/g, ''))
  if (!m) {
    throw new Error(
      `action anchor locus "${locus}" is not <refName>:<start>[-<end>]`,
    )
  }
  const start = Number(m[2]) - 1
  return { refName: m[1]!, start, end: m[3] ? Number(m[3]) : start + 1 }
}
