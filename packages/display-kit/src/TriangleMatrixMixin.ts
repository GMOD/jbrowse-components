import { getConf, setConf } from '@jbrowse/core/configuration'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { types } from '@jbrowse/mobx-state-tree'
import { oneCell } from '@jbrowse/render-core/installUpload'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { svgLegendGutterWidth } from './LegendMixin.ts'
import {
  computeTriangleYScalar,
  triangleDataToScreen,
  triangleScreenToData,
  triangleViewTransform,
} from './triangleTransform.ts'

import type { RegionHost } from './regionHost.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

/** The slots a triangle display declares for this mixin. */
export const triangleMatrixConfigSchemaFields = {
  /**
   * #slot
   */
  showLegend: {
    type: 'boolean',
    defaultValue: false,
    description: 'show the color scale legend',
  },
  /**
   * #slot
   */
  squashToHeight: {
    type: 'boolean',
    defaultValue: false,
    description:
      'squash the triangle vertically to fill the display height instead of drawing square cells',
  },
} as const

type TriangleMatrixConfigModel = ConfigModelForFields<
  typeof triangleMatrixConfigSchemaFields
>

interface TriangleMatrixHost {
  configuration: TriangleMatrixConfigModel
  host: RegionHost
  height: number
  showLegend: boolean
}

// Composed beside TrackHeightMixin, GlobalFetchMixin and LegendMixin, which
// supply these; the mixin's own `self` cannot see them.
const hostOf = (self: object) => self as TriangleMatrixHost

/** What a triangle payload carries for the view transform. */
export interface TrianglePayload {
  originBp: number
}

/** The per-frame geometry every triangle mark reads. */
export interface TriangleFrame {
  yScalar: number
  viewScale: number
  viewOffsetX: number
  canvasWidth: number
  canvasHeight: number
}

/**
 * #stateModel TriangleMatrixMixin
 * #category display
 * #crossCuttingMixin A matrix drawn as a triangle over the view's axis (Hi-C, LD): the fetched payload (`rpcData`), the canvas box (`canvasWidth`, `matrixHeight` under the `matrixTop` hook), the rotate-and-squash transform and its inverse (`cellToScreen`, `screenToCell`), the frame the marks read (`triangleFrame`), the one-cell region map and canvas-wide block the mark backend draws (`matrixRegions`, `matrixBlocks`), and the `squashToHeight` slot. Composes after `TrackHeightMixin`, `GlobalFetchMixin` and `LegendMixin`
 */
export default function TriangleMatrixMixin<D extends TrianglePayload>() {
  return types
    .model('TriangleMatrixMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as D | null,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get squashToHeight(): boolean {
        return getConf(hostOf(self), 'squashToHeight')
      },
      /**
       * #getter
       * Overridable hook (default 0): px reserved above the matrix.
       */
      get matrixTop(): number {
        return 0
      },
      /**
       * #getter
       * The canvas spans the scrolled content, boundary padding included.
       */
      get canvasWidth(): number {
        return hostOf(self).host.totalWidthPx
      },
      /**
       * #getter
       */
      get viewTransform() {
        return triangleViewTransform(hostOf(self).host, self.rpcData)
      },
      /**
       * #getter
       * The one payload under key 0, absent until the fetch lands. An empty
       * matrix keeps the key: the cleared canvas is its picture.
       */
      get matrixRegions(): ReadonlyMap<number, D> {
        return oneCell(0, self.rpcData)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get matrixHeight(): number {
        return Math.max(1, hostOf(self).height - self.matrixTop)
      },
      /**
       * #getter
       */
      get matrixBlocks() {
        return canvasWideBlocks([0], self.canvasWidth)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The squash takes the content's base, without the boundary padding a
       * scroll past either end adds.
       */
      get yScalar(): number {
        return computeTriangleYScalar({
          squashToHeight: self.squashToHeight,
          displayHeight: self.matrixHeight,
          triangleWidth: hostOf(self).host.totalWidthPxWithoutBorders,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get triangleTransform() {
        return {
          ...self.viewTransform,
          yScalar: self.yScalar,
          yOffsetPx: self.matrixTop,
        }
      },
      /**
       * #getter
       */
      get triangleFrame(): TriangleFrame {
        return {
          ...self.viewTransform,
          yScalar: self.yScalar,
          canvasWidth: self.canvasWidth,
          canvasHeight: self.matrixHeight,
        }
      },
      /**
       * #method
       * The export parks the key beside the matrix, which fills its band.
       */
      svgLegendWidth(): number {
        return svgLegendGutterWidth(hostOf(self))
      },
    }))
    .views(self => ({
      /**
       * #method
       * Pre-rotation cell coordinates to display px.
       */
      cellToScreen(x: number, y: number) {
        return triangleDataToScreen(x, y, self.triangleTransform)
      },
      /**
       * #method
       * The exact inverse of `cellToScreen`.
       */
      screenToCell(x: number, y: number) {
        return triangleScreenToData(x, y, self.triangleTransform)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(data: D) {
        self.rpcData = data
      },
      /**
       * #action
       */
      setSquashToHeight(value: boolean) {
        setConf(hostOf(self), 'squashToHeight', value)
      },
    }))
}

/** The "Fit to display height" row both triangle menus list. */
export function squashToHeightCheckboxItem(self: {
  squashToHeight: boolean
  setSquashToHeight: (arg: boolean) => void
}): MenuItem {
  return toggleItem(
    'Fit to display height',
    self.squashToHeight,
    self.setSquashToHeight,
    {
      helpText:
        'Squash the triangle vertically to fill the display height instead of drawing square cells at its natural half-width height.',
    },
  )
}
