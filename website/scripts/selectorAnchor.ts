import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// The testid prefixes a view's own box can carry, either of which scopes a
// query to that view. Two, because they cover different views: app-core's
// ViewContainer stamps `view-container-` around each of the session's own
// views, and `linear-genome-view-` is on the LGV itself — which is the only one
// a nested view has, since nothing wraps a row of a synteny stack.
//
// Read by `locusAnchor.ts` too, for the `band` selector it matches inside a
// view. Both build the query in the page, where `CSS.escape` is.
export const VIEW_SCOPE_TESTIDS = ['view-container', 'linear-genome-view']

// The point on an element an action acts at, in viewport CSS px.
//
// A callout has resolved `selector` anchors since the overlay was written; an
// action's `fromAnchor`/`toAnchor` share that type but only ever routed to the
// model resolvers, so a spec naming a selector reached `locusPoint` with no
// locus and failed as "anchor locus "" is not <refName>:<start>[-<end>]". The
// shape it was written in is the one that has no model answer: a drag on a
// synteny row's ruler, whose x is a fraction of a strip rather than a locus —
// the row's own coordinates are whatever the launch resolved the anchor's
// window to, so naming them would pin the tour to one resolution of the PAF.
//
// `view` scopes the query inside that view's container the way `band` does in
// locusAnchor, which is what makes `[0, 1]` mean "the second row's ruler"
// rather than "the first `rubberband_controls` on the page". Without a `view`
// the query is the whole document, matching the overlay's own `domRect`.
//
// `alignX`/`alignY` pick which point of the rect (default its centre) and
// `dx`/`dy` nudge it, the same three fields and the same defaults the overlay
// reads — so an arrow drawn at an element's left edge + 40 and a click at the
// same place are written the same way.
export async function selectorPoint(page: Page, anchor: AnnotationAnchor) {
  const path = Array.isArray(anchor.view)
    ? anchor.view
    : anchor.view === undefined
      ? undefined
      : [anchor.view]
  const point = await page.evaluate(
    (
      viewPath: number[] | undefined,
      selector: string,
      alignX: string,
      alignY: string,
      scopeTestids: string[],
    ) => {
      interface AnchorableView {
        id: string
        views?: AnchorableView[]
      }
      let scope: ParentNode | null = document
      if (viewPath) {
        let view = (window as unknown as { JBrowseSession?: AnchorableView })
          .JBrowseSession
        for (const i of viewPath) {
          view = view?.views?.[i]
        }
        scope = view
          ? document.querySelector(
              scopeTestids
                .map(t => `[data-testid="${t}-${CSS.escape(view.id)}"]`)
                .join(', '),
            )
          : null
      }
      const el = scope?.querySelector(selector)
      if (!el) {
        return undefined
      }
      const r = el.getBoundingClientRect()
      return {
        x:
          alignX === 'left'
            ? r.left
            : alignX === 'right'
              ? r.right
              : r.left + r.width / 2,
        y:
          alignY === 'top'
            ? r.top
            : alignY === 'bottom'
              ? r.bottom
              : r.top + r.height / 2,
      }
    },
    path,
    anchor.selector!,
    anchor.alignX ?? 'center',
    anchor.alignY ?? 'center',
    VIEW_SCOPE_TESTIDS,
  )
  return point
    ? { x: point.x + (anchor.dx ?? 0), y: point.y + (anchor.dy ?? 0) }
    : undefined
}
