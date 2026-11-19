import type { AbstractViewModel } from '@jbrowse/core/util'
import type { VisibleRegion } from '@jbrowse/display-kit/regionHost'

const MIN_MARKER_WIDTH = 3

export interface ZoomMarker {
  id: string
  left: number
  width: number
}

export interface ZoomLinkable {
  id: string
  zoomOf?: string
  minimized: boolean
  volatileWidth?: number
  visibleRegions: VisibleRegion[]
  zoomMarkers: ZoomMarker[]
}

export function isZoomLinkable(
  view: AbstractViewModel,
): view is AbstractViewModel & ZoomLinkable {
  return view.type === 'LinearGenomeView'
}

export function visibleEdges(regions: VisibleRegion[]) {
  const first = regions[0]
  const last = regions.at(-1)
  return first && last
    ? {
        left: {
          assemblyName: first.assemblyName,
          refName: first.refName,
          coord: first.reversed ? first.end : first.start,
        },
        right: {
          assemblyName: last.assemblyName,
          refName: last.refName,
          coord: last.reversed ? last.start : last.end,
        },
      }
    : undefined
}

export function zoomMarker(id: string, x1: number, x2: number): ZoomMarker {
  const left = Math.min(x1, x2)
  const width = Math.abs(x2 - x1)
  return width < MIN_MARKER_WIDTH
    ? {
        id,
        left: left + width / 2 - MIN_MARKER_WIDTH / 2,
        width: MIN_MARKER_WIDTH,
      }
    : { id, left, width }
}
