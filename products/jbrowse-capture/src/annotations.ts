import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
  parseAnnotationLocus,
} from './annotationOverlay.ts'
import { assertValidAnnotations } from './annotationSpec.ts'
import { dotplotAnchorRect } from './dotplotAnchor.ts'
import { graphNodeRect } from './graphAnchor.ts'

import type {
  Annotation,
  AnnotationAnchor,
  PayloadAnnotation,
  ResolvedAnnotationAnchor,
} from './annotationOverlay.ts'
import type { Page } from 'puppeteer'

// Attach the parsed region so page context never parses strings, plus the
// viewport rect of the two anchor kinds that resolve out here rather than in
// the overlay: a graph node, and a dotplot's pair of axes. Both draw into a
// single canvas, so there is no element in the page for the overlay to measure
// and the view's own layout is the only thing that knows where they went.
//
// `wantBounds` is the same question for both kinds of anchor: does this callout
// WRAP the thing it names, or point at it? A force-directed graph node bends, so
// the centre of its bounding box can sit off the node and everything but a box
// wants a point ON it (a dotplot block's cell is a rectangle either way). A
// one-base locus is the same shape of question — the base's own column for a
// box, the zero-width position between two bases for a pill or an arrow head —
// which is what parseAnnotationLocus's `wrap` decides.
async function withRegion(
  page: Page,
  anchor: AnnotationAnchor | undefined,
  wantBounds: boolean,
): Promise<ResolvedAnnotationAnchor | undefined> {
  if (!anchor) {
    return undefined
  }
  const isDotplot = anchor.hLoc !== undefined || anchor.vLoc !== undefined
  return {
    ...anchor,
    region: anchor.loc
      ? parseAnnotationLocus(anchor.loc, wantBounds)
      : undefined,
    rect: anchor.graphNode
      ? await graphNodeRect(page, anchor, wantBounds)
      : isDotplot
        ? await dotplotAnchorRect(page, anchor)
        : undefined,
  }
}

/** Remove the callout overlay a previous `drawAnnotations` left on the page. */
export async function clearAnnotations(page: Page) {
  await page.evaluate(id => {
    document.getElementById(id)?.remove()
  }, ANNOTATION_OVERLAY_ID)
}

/**
 * Draw callouts (arrows, boxes, labels, badges) over the page as one fixed SVG
 * overlay, so the next screenshot includes them. Each anchor resolves against
 * the live session — a locus through the view model, a graph node or dotplot
 * cell through its view's layout, page chrome by selector or text — so nothing
 * is a measured pixel. Throws when an anchor resolves to nothing or a callout
 * lands outside the viewport, rather than writing a figure with a callout
 * parked in the corner or missing.
 */
export async function drawAnnotations(page: Page, annotations: Annotation[]) {
  assertValidAnnotations(annotations)
  await clearAnnotations(page)
  const items: PayloadAnnotation[] = await Promise.all(
    annotations.map(async a => ({
      ...a,
      // only a box wants the drawn bounds — of a graph node, or of the base a
      // one-coordinate locus names; a ring/arrow/label wants a point on it, and
      // an arrow's tail always does
      anchor: await withRegion(page, a.anchor, a.type === 'box'),
      fromAnchor: await withRegion(page, a.fromAnchor, false),
    })),
  )
  const { unresolved, offFrame } = await page.evaluate(
    drawAnnotationOverlay,
    items,
    ANNOTATION_OVERLAY_ID,
  )
  if (unresolved.length > 0) {
    throw new Error(
      `annotation anchors resolved to nothing: ${unresolved.join(', ')}`,
    )
  }
  if (offFrame.length > 0) {
    throw new Error(
      `annotations drew outside the capture: ${offFrame.join(', ')}`,
    )
  }
}
