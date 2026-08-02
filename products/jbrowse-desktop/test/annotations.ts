import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
  parseAnnotationLocus,
} from '@jbrowse/browser-test-utils/annotationOverlay'

import type {
  Annotation,
  AnnotationAnchor,
  PayloadAnnotation,
  ResolvedAnnotationAnchor,
} from '@jbrowse/browser-test-utils/annotationOverlay'
import type { WebDriver } from 'selenium-webdriver'

export type { Annotation, AnnotationAnchor }

// The selenium half of the shared callout overlay: the same
// `drawAnnotationOverlay` the website's puppeteer generator injects, so a
// desktop figure's arrows, boxes and pills are drawn by the same code as a web
// figure's and can't style-drift from them. Only the injection differs —
// `executeScript` here, `page.evaluate` there — plus the node-side locus parse,
// which keeps page context a pure lookup.
//
// There is no graphNode anchoring here: that resolves against a
// GraphGenomeView's own layout out in node, and no desktop figure has one.

function resolveAnchor(
  anchor: AnnotationAnchor | undefined,
): ResolvedAnnotationAnchor | undefined {
  return anchor
    ? {
        ...anchor,
        region: anchor.locus ? parseAnnotationLocus(anchor.locus) : undefined,
      }
    : undefined
}

export async function clearAnnotations(driver: WebDriver): Promise<void> {
  await driver.executeScript(
    'document.getElementById(arguments[0])?.remove()',
    ANNOTATION_OVERLAY_ID,
  )
}

// Draws the callouts, then throws on any anchor that resolved to nothing —
// which is a stale selector or a label that has been renamed, not a styling
// mistake, and would otherwise park its callout in the corner of the figure.
export async function drawAnnotations(
  driver: WebDriver,
  annotations: Annotation[],
): Promise<void> {
  await clearAnnotations(driver)
  const items: PayloadAnnotation[] = annotations.map(a => ({
    ...a,
    anchor: resolveAnchor(a.anchor),
    fromAnchor: resolveAnchor(a.fromAnchor),
  }))
  const unresolved = await driver.executeScript<string[]>(
    drawAnnotationOverlay,
    items,
    ANNOTATION_OVERLAY_ID,
  )
  if (unresolved.length > 0) {
    throw new Error(
      `annotation anchors resolved to nothing: ${unresolved.join(', ')}`,
    )
  }
}
