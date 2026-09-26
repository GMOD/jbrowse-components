import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

export interface ViewportRect {
  left: number
  top: number
  width: number
  height: number
}

// The bounding box of a node's drawn polyline, plus a point that is guaranteed
// to be ON it. They are not the same thing: a force-directed drawing bends a
// long node into an arc, and the centre of its bounding box can sit in the empty
// space the arc encloses — a hover there hits nothing. So a box callout takes
// the bounds and everything else (a ring, an arrow head, a click) takes the
// polyline's middle vertex.
export interface GraphNodeGeometry extends ViewportRect {
  midX: number
  midY: number
}

// The graph pane an anchor addresses, and the canvas it draws on. The graph is
// one canvas with no element per node, so the pane is asked where it put one
// instead, the way a locus anchor asks the LGV. The pane is the addressed view
// itself when that is a GraphGenomeView, and otherwise the `pane` of a
// LinearGraphDisplay among the view's tracks: the one `trackId` names, or the
// first.
//
// Puppeteer serializes this into the page, so it closes over nothing.
export function locateGraphPaneInPage(
  viewPath: number[],
  trackId: string | undefined,
) {
  interface Pane {
    // The two axis scales, which are NOT always the same number: a
    // reference-anchored layout states y as a row pitch in screen px and pins
    // scaleY at 1, while scaleX is the zoom. `scale` is the x one.
    scale?: number
    scaleX?: number
    scaleY?: number
    translateX?: number
    translateY?: number
    nodePositions?: Record<string, { x: number; y: number }[]>
    graph?: {
      nodes: {
        id: string
        length?: number
        stable?: {
          rank?: number
          refName?: string
          start?: number
          end?: number
        }
      }[]
    }
  }
  interface Track {
    configuration?: { trackId?: string }
    displays?: { pane?: Pane }[]
  }
  interface View extends Pane {
    id: string
    views?: View[]
    tracks?: Track[]
  }
  let view = (window as unknown as { JBrowseSession?: View }).JBrowseSession
  for (const i of viewPath) {
    view = view?.views?.[i]
  }
  if (!view) {
    return undefined
  }
  const container = `[data-testid="view-container-${CSS.escape(view.id)}"]`
  let pane: Pane | undefined = view
  let scope = container
  if (view.tracks) {
    const track = view.tracks.find(
      t =>
        t.displays?.some(d => d.pane) &&
        (trackId === undefined || t.configuration?.trackId === trackId),
    )
    pane = track?.displays?.find(d => d.pane)?.pane
    const id = track?.configuration?.trackId ?? ''
    scope = `${container} [data-testid="trackRenderingContainer-${CSS.escape(view.id)}-${CSS.escape(id)}"] [data-testid="linear-graph-display"]`
  }
  const canvas = document.querySelector(
    `${scope} [data-testid="graph-genome-canvas"]`,
  )
  return pane && canvas ? { pane, canvas } : undefined
}

export type LocatedGraphPane = NonNullable<
  ReturnType<typeof locateGraphPaneInPage>
>

// Where the located pane drew one GFA segment, in viewport CSS px: its
// `nodePositions` in graph world units through the transform the renderer
// draws with. Undefined when the node isn't there, so the caller can fail the
// spec by name rather than acting on (0,0). Serialized into the page too.
export function nodeGeometryInPage(
  located: LocatedGraphPane | undefined,
  nodeId: string,
): GraphNodeGeometry | undefined {
  if (!located) {
    return undefined
  }
  const { pane, canvas } = located
  // nodePositions is keyed by the node's drawn id, which carries the
  // orientation the cut walked the segment in ('s2037+'), so a spec may name
  // either that or the bare GFA segment id
  const positions = pane.nodePositions
  const pts =
    positions?.[nodeId] ??
    positions?.[`${nodeId}+`] ??
    positions?.[`${nodeId}-`]
  if (!pts?.length) {
    return undefined
  }
  const r = canvas.getBoundingClientRect()
  const scaleX = pane.scaleX ?? pane.scale ?? 1
  const scaleY = pane.scaleY ?? pane.scale ?? 1
  const tx = pane.translateX ?? 0
  const ty = pane.translateY ?? 0
  const xs = pts.map(p => p.x * scaleX + tx)
  const ys = pts.map(p => p.y * scaleY + ty)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const mid = pts[Math.floor((pts.length - 1) / 2)]!
  return {
    left: r.left + left,
    top: r.top + top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
    midX: r.left + mid.x * scaleX + tx,
    midY: r.top + mid.y * scaleY + ty,
  }
}

export function locateGraphPane(
  page: Page,
  anchor: Pick<AnnotationAnchor, 'view' | 'track'>,
) {
  const path = Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0]
  return page.evaluateHandle(locateGraphPaneInPage, path, anchor.track)
}

async function graphNodeGeometry(page: Page, anchor: AnnotationAnchor) {
  const located = await locateGraphPane(page, anchor)
  try {
    return await located.evaluate(nodeGeometryInPage, anchor.graphNode ?? '')
  } finally {
    await located.dispose()
  }
}

// What a click/hover/ring acts on: a point on the node itself.
export async function graphNodePoint(page: Page, anchor: AnnotationAnchor) {
  const geom = await graphNodeGeometry(page, anchor)
  return geom
    ? { x: geom.midX + (anchor.dx ?? 0), y: geom.midY + (anchor.dy ?? 0) }
    : undefined
}

// What an annotation resolves to: the drawn bounds for a box, a zero-size rect
// on the node for anything else (so its centre lands on the node, not in the
// space a bent node encloses).
export async function graphNodeRect(
  page: Page,
  anchor: AnnotationAnchor,
  wantBounds: boolean,
): Promise<ViewportRect | undefined> {
  const geom = await graphNodeGeometry(page, anchor)
  if (!geom) {
    return undefined
  }
  return wantBounds
    ? { left: geom.left, top: geom.top, width: geom.width, height: geom.height }
    : { left: geom.midX, top: geom.midY, width: 0, height: 0 }
}
