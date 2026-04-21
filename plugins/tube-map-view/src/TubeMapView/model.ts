import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { types } from '@jbrowse/mobx-state-tree'

import { parseGFA } from '../gfa/gfaParser.ts'
import { layoutGFA } from '../layout/gfaToTubeMap.ts'

import type { TubeMapLayout } from '../layout/types.ts'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
export const CANVAS_HEIGHT = 500

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export default function stateModelFactory() {
  return types
    .compose(
      'TubeMapView',
      BaseViewModel,
      types.model({
        type: types.literal('TubeMapView'),
      }),
    )
    .volatile(() => ({
      layout: undefined as TubeMapLayout | undefined,
      graphName: '',
      error: undefined as string | undefined,
      isLoading: false,
      scale: 1,
      translateX: 0,
      translateY: 0,
      hoveredNode: null as number | null,
      hoveredTrack: null as number | null,
      selectedNode: null as number | null,
      widthPerBp: 10,
    }))
    .views(self => ({
      get hasLayout() {
        return self.layout !== undefined
      },
      get nodeCount() {
        return self.layout?.nodes.length ?? 0
      },
      get trackCount() {
        return self.layout?.tracks.length ?? 0
      },
    }))
    .actions(self => ({
      setError(error: string) {
        self.error = error
        self.isLoading = false
      },
      setHoveredNode(idx: number | null) {
        self.hoveredNode = idx
      },
      setHoveredTrack(idx: number | null) {
        self.hoveredTrack = idx
      },
      setSelectedNode(idx: number | null) {
        self.selectedNode = idx
      },
      setTransform(s: number, tx: number, ty: number) {
        self.scale = clampZoom(s)
        self.translateX = tx
        self.translateY = ty
      },
      zoom(factor: number, centerX: number, centerY: number) {
        const newScale = clampZoom(self.scale * factor)
        const ratio = newScale / self.scale
        self.scale = newScale
        self.translateX = centerX - (centerX - self.translateX) * ratio
        self.translateY = centerY - (centerY - self.translateY) * ratio
      },
      zoomToFit(containerHeight: number) {
        if (self.layout) {
          const padding = 40
          const scaleX = (self.width - padding * 2) / self.layout.maxX
          const scaleY = (containerHeight - padding * 2) / self.layout.maxY
          const newScale = clampZoom(Math.min(scaleX, scaleY))
          self.scale = newScale
          self.translateX =
            padding +
            (self.width - padding * 2 - self.layout.maxX * newScale) / 2
          self.translateY =
            padding +
            (containerHeight - padding * 2 - self.layout.maxY * newScale) / 2
        }
      },
      loadGFA(text: string, name = 'Imported GFA') {
        self.isLoading = true
        self.error = undefined
        self.graphName = name
        const gfa = parseGFA(text)
        self.layout = layoutGFA(gfa, self.widthPerBp)
        self.isLoading = false
        if (self.width > 0) {
          this.zoomToFit(CANVAS_HEIGHT)
        }
      },
      clearGraph() {
        self.layout = undefined
        self.error = undefined
        self.hoveredNode = null
        self.hoveredTrack = null
        self.selectedNode = null
      },
    }))
}

export type TubeMapViewModel = ReturnType<
  ReturnType<typeof stateModelFactory>['create']
>
