import { parseAnnotationLocus, viewPathOf } from './annotationOverlay.ts'

import type { AnnotationAnchor, AnnotationRegion } from './annotationOverlay.ts'
import type { ViewportRect } from './graphAnchor.ts'
import type { Page } from 'puppeteer'

// Where a track's display drew a feature or record it names, in viewport CSS
// px. A fraction of the track's height moves whenever a band is added above
// its target, and nothing fails: the click or callout lands on another row.
// The display already boxes every named feature it drew (`featuresNamed`, the
// same ink its floating labels read), so ask it.
//
// The display lists every laid-out feature the name labels, drawn or not, so a
// copy scrolled or packed out of sight still counts: a name is a miss unless
// it labels one feature and that one drew. `region` narrows the drawn copies to
// the one overlapping that locus, for a label as common as `C -> T <1%`. A
// miss is undefined, so the caller fails the spec by name.
//
// Puppeteer serializes this into the page, so it closes over nothing.
export function featureRectInPage(
  viewPath: number[],
  trackId: string,
  name: string,
  region: AnnotationRegion | undefined,
) {
  interface Box {
    left: number
    top: number
    width: number
    height: number
  }
  interface Display {
    featuresNamed?: (name: string) => { box: Box | undefined }[]
  }
  interface View {
    id: string
    views?: View[]
    assemblyNames?: string[]
    tracks?: { configuration?: { trackId?: string }; displays?: Display[] }[]
    getHighlightCoords?: (region: {
      assemblyName?: string
      refName: string
      start: number
      end: number
    }) => { left: number; width: number } | undefined
  }
  let view = (window as unknown as { JBrowseSession?: View }).JBrowseSession
  for (const i of viewPath) {
    view = view?.views?.[i]
  }
  const display = view?.tracks
    ?.find(t => t.configuration?.trackId === trackId)
    ?.displays?.find(d => typeof d.featuresNamed === 'function')
  const container =
    view &&
    document.querySelector(
      `[data-testid="trackRenderingContainer-${CSS.escape(view.id)}-${CSS.escape(trackId)}"]`,
    )
  const matches = display?.featuresNamed?.(name) ?? []
  const span =
    region &&
    view?.getHighlightCoords?.({
      ...region,
      assemblyName: view.assemblyNames?.[0],
    })
  const candidates = span
    ? matches.filter(
        ({ box: b }) =>
          b && b.left < span.left + span.width && b.left + b.width > span.left,
      )
    : matches
  const box = candidates.length === 1 ? candidates[0]?.box : undefined
  if (!box || !container) {
    return undefined
  }
  const r = container.getBoundingClientRect()
  return {
    left: r.left + box.left,
    top: r.top + box.top,
    width: box.width,
    height: box.height,
  }
}

async function featureBox(page: Page, anchor: AnnotationAnchor) {
  return anchor.feature === undefined || anchor.trackId === undefined
    ? undefined
    : page.evaluate(
        featureRectInPage,
        viewPathOf(anchor),
        anchor.trackId,
        anchor.feature,
        anchor.loc ? parseAnnotationLocus(anchor.loc, true) : undefined,
      )
}

// The feature's box, or with `fracY` the line through it at that fraction of
// its height (0 its top edge), which is what an arrow head on a tall glyph
// wants.
export async function featureRect(
  page: Page,
  anchor: AnnotationAnchor,
): Promise<ViewportRect | undefined> {
  const box = await featureBox(page, anchor)
  return box && anchor.fracY !== undefined
    ? { ...box, top: box.top + anchor.fracY * box.height, height: 0 }
    : box
}
