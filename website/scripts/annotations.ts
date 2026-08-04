// Deep import, not the package barrel: the barrel re-exports the puppeteer
// harness, and `screenshot-spec-types.ts` re-exports these types for consumers
// (gallery link generation) that must not pull puppeteer in.
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
  parseAnnotationLocus,
} from '@jbrowse/browser-test-utils/annotationOverlay'

import { graphNodeRect } from './graphAnchor.ts'

import type {
  Annotation,
  AnnotationAnchor,
  PayloadAnnotation,
  ResolvedAnnotationAnchor,
} from '@jbrowse/browser-test-utils/annotationOverlay'
import type { Page } from 'puppeteer'

// Attach the parsed region so page context never parses strings, plus the
// viewport rect of a graphNode anchor (resolved out here, against the graph
// view's own layout, because the graph is a canvas with nothing to measure).
async function withRegion(
  page: Page,
  anchor: AnnotationAnchor | undefined,
  wantBounds: boolean,
): Promise<ResolvedAnnotationAnchor | undefined> {
  return anchor
    ? {
        ...anchor,
        region: anchor.locus ? parseAnnotationLocus(anchor.locus) : undefined,
        rect: anchor.graphNode
          ? await graphNodeRect(page, anchor, wantBounds)
          : undefined,
      }
    : undefined
}

// Remove any annotation overlay left over from a previous frame so staged
// figures don't carry one stage's callouts into the next.
export async function clearAnnotations(page: Page) {
  await page.evaluate(id => {
    document.getElementById(id)?.remove()
  }, ANNOTATION_OVERLAY_ID)
}

// Draw spec.annotations as a fixed SVG overlay covering the viewport so the
// callouts composite into the screenshot. The drawing itself is
// `drawAnnotationOverlay`, shared with the desktop selenium harness; this is
// the puppeteer half — node-side anchor resolution plus the evaluate.
//
// An anchored annotation resolves its geometry at capture time — from the live
// view model for a genomic locus, or from a DOM element's bounding box for page
// chrome — so no viewport coordinate has to be hand-tuned against a previous
// capture. An anchor that resolves to nothing throws rather than quietly
// parking its callout at the origin.
export async function drawAnnotations(page: Page, annotations: Annotation[]) {
  await clearAnnotations(page)
  const items: PayloadAnnotation[] = await Promise.all(
    annotations.map(async a => ({
      ...a,
      // only a box wants the node's drawn bounds; a ring/arrow/label wants a
      // point on it, and an arrow's tail always does
      anchor: await withRegion(page, a.anchor, a.type === 'box'),
      fromAnchor: await withRegion(page, a.fromAnchor, false),
    })),
  )
  const unresolved = await page.evaluate(
    drawAnnotationOverlay,
    items,
    ANNOTATION_OVERLAY_ID,
  )
  // An anchor that resolves to nothing silently falls back to (x ?? 0, y ?? 0),
  // which parks the callout in the top-left corner rather than removing it — a
  // failure that looks like a styling mistake in review instead of a stale
  // spec. Surface it as the error it is.
  if (unresolved.length > 0) {
    throw new Error(
      `annotation anchors resolved to nothing: ${unresolved.join(', ')}`,
    )
  }
}

// Both tooltip kinds, as one selector list: JBrowse's BaseTooltip portals with
// an inline z-index of 100000 (MUI menus use 1300), and MUI's own `title`
// tooltips portal to `.MuiTooltip-popper`, whose z-index is theme-dependent.
const TOOLTIP_SELECTORS = ['.MuiTooltip-popper']

/**
 * The text of a tooltip on screen, or undefined if there is none.
 *
 * Read before the shot so the run can report a tooltip the spec did not ask for
 * — the accidental kind, left behind because a click sequence ended on a
 * hoverable control. The text is what makes the report actionable: it says which
 * control the cursor was parked on.
 */
export async function visibleTooltipText(page: Page) {
  return page.evaluate(selectors => {
    const found: Element[] = [...document.querySelectorAll('div')].filter(
      el => (el as HTMLElement).style.zIndex === '100000',
    )
    for (const sel of selectors) {
      found.push(...document.querySelectorAll(sel))
    }
    for (const el of found) {
      // getClientRects is empty for a display:none or unmounted portal, which is
      // how a tooltip that has faded out is told from one that is showing
      if (el.getClientRects().length > 0) {
        const text = el.textContent.trim()
        if (text) {
          return text
        }
      }
    }
    return undefined
  }, TOOLTIP_SELECTORS)
}

export async function hideLingeringTooltip(page: Page) {
  // Two kinds, and a spec asking for neither has to say so once.
  //
  // BaseTooltip (the feature/hover tooltip) renders into a portal with inline
  // z-index:100000 (MUI menus use 1300), so matching on that targets it without
  // touching the context menu a figure may want to keep.
  //
  // MUI's own `title` tooltips are the other kind, and they used to sail
  // through: any action ending on a toolbar button leaves the cursor over it,
  // and the tooltip fades in during the settle before the shot. That is how a
  // "View options" bubble got into read_vs_ref_insertion. They portal to
  // `.MuiTooltip-popper`, whose z-index is theme-dependent, so match the class
  // rather than another number.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('div')) {
      if (el.style.zIndex === '100000') {
        el.style.display = 'none'
      }
    }
    for (const el of document.querySelectorAll<HTMLElement>(
      '.MuiTooltip-popper',
    )) {
      el.style.display = 'none'
    }
  })
}
