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

// Where a GraphGenomeView drew one GFA segment, in viewport CSS px.
//
// The graph is a single canvas: there is no element per node, so a callout or a
// hover target at a node was a raw viewport coordinate, which holds only while
// the layout is deterministic AND unchanged. Switching `layoutMode` moves every
// node and nothing notices. The view already knows where it put each node —
// `nodePositions` in graph world units, plus the `scale`/`translateX`/
// `translateY` the renderer draws with — so ask it, the same way a locus anchor
// asks the LGV.
//
// Returns undefined when the view/node/canvas isn't there, so the caller can
// fail the spec by name rather than acting on (0,0).
async function graphNodeGeometry(
  page: Page,
  anchor: AnnotationAnchor,
): Promise<GraphNodeGeometry | undefined> {
  const path = Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0]
  return page.evaluate(
    (viewPath: number[], nodeId: string) => {
      interface GraphView {
        id: string
        views?: GraphView[]
        scale?: number
        translateX?: number
        translateY?: number
        nodePositions?: Record<string, { x: number; y: number }[]>
      }
      let view = (window as unknown as { JBrowseSession?: GraphView })
        .JBrowseSession
      for (const i of viewPath) {
        view = view?.views?.[i]
      }
      // nodePositions is keyed by the node's drawn id, which carries the
      // orientation the cut walked the segment in ('s2037+'), so a spec may name
      // either that or the bare GFA segment id
      const positions = view?.nodePositions
      const pts =
        positions?.[nodeId] ??
        positions?.[`${nodeId}+`] ??
        positions?.[`${nodeId}-`]
      if (!view || !pts?.length) {
        return undefined
      }
      const canvas = document.querySelector(
        `[data-testid="view-container-${CSS.escape(view.id)}"] [data-testid="graph-genome-canvas"]`,
      )
      if (!canvas) {
        return undefined
      }
      const r = canvas.getBoundingClientRect()
      const scale = view.scale ?? 1
      const tx = view.translateX ?? 0
      const ty = view.translateY ?? 0
      const xs = pts.map(p => p.x * scale + tx)
      const ys = pts.map(p => p.y * scale + ty)
      const left = Math.min(...xs)
      const top = Math.min(...ys)
      const mid = pts[Math.floor((pts.length - 1) / 2)]!
      return {
        left: r.left + left,
        top: r.top + top,
        width: Math.max(...xs) - left,
        height: Math.max(...ys) - top,
        midX: r.left + mid.x * scale + tx,
        midY: r.top + mid.y * scale + ty,
      }
    },
    path,
    anchor.graphNode ?? '',
  )
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
