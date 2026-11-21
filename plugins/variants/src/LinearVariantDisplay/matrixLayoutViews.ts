import { locusViewportXFor } from '../shared/genomicViewportX.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { ConnectorCoord } from '../shared/ConnectorLines.tsx'
import type { VariantMatrixRenderBlock } from './matrix/variantMatrixRenderingBackendTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type ConnectorView = Parameters<typeof locusViewportXFor>[0]['view']

/**
 * What the columns layout reads: the payload's variants, the view's content
 * width and its locus mapping, and the scroll that places the content.
 */
export interface MatrixLayoutHost extends IStateTreeNode {
  cellData: CellDataResult | undefined
  view: ConnectorView & { totalWidthPxWithoutBorders: number }
  host: { offsetPx: number }
}

/**
 * The columns layout's geometry: one equal-width column per variant across
 * the content, and the connector tying each to its genomic position, in
 * four layers, each reading the ones before it.
 */
export function matrixLayoutViews(self: MatrixLayoutHost) {
  return {
    /**
     * #getter
     * The width the columns are laid out in: the rounded **content**
     * width, so they still fill the drawn matrix when the genome doesn't
     * reach across the viewport. Not `canvasWidthPx`, the viewport box a
     * span maps bp into — the LD display's triangle takes the same width
     * for the same reason.
     */
    get matrixWidth() {
      return self.view.totalWidthPxWithoutBorders
    },
  }
}

export function matrixColumnGeometryViews(
  self: MatrixLayoutHost & ReturnType<typeof matrixLayoutViews>,
) {
  return {
    /**
     * #getter
     * Column pitch and origin in viewport pixels: `left` is where the
     * content starts when it doesn't reach the left viewport edge. The
     * connector lines, their hit test and the crosshair column all key off
     * this, so columns, lines and clicks stay pixel-aligned.
     */
    get columnGeometry() {
      const n = self.cellData?.simplifiedFeatures.length ?? 0
      return {
        n,
        columnWidth: n ? self.matrixWidth / n : 0,
        left: Math.max(0, -self.host.offsetPx),
      }
    },
  }
}

export function matrixColumnViews(
  self: MatrixLayoutHost &
    ReturnType<typeof matrixLayoutViews> &
    ReturnType<typeof matrixColumnGeometryViews>,
) {
  return {
    /**
     * #getter
     * The one block the column layout draws: the whole canvas, spanning
     * the column indices. One column wide when there are none, since the
     * GPU backend skips a block with no span and the canvas would never
     * count as painted.
     */
    get matrixBlocks(): VariantMatrixRenderBlock[] {
      return [
        {
          displayedRegionIndex: 0,
          start: 0,
          end: Math.max(self.columnGeometry.n, 1),
          screenStartPx: 0,
          screenEndPx: self.matrixWidth,
          reversed: false,
        },
      ]
    },
    /**
     * #getter
     * One connector per column, **by column**, in viewport pixels: `mx`
     * the column centre, `gx` the variant's position on the ruler,
     * `label` what the hover tooltip shows. `undefined` where the variant's
     * refName has left the view. Indexed rather than filtered, so the
     * crosshair can ask of one column what the drawn field asks of all.
     * Column and data index are one number: the worker ships the variants
     * in screen order.
     */
    get connectorCoordsByColumn(): (ConnectorCoord | undefined)[] {
      const features = self.cellData?.simplifiedFeatures ?? []
      const locusX = locusViewportXFor(self)
      const { columnWidth, left } = self.columnGeometry
      return features.map(({ data }, i) => {
        const gx = locusX(String(data.refName), Number(data.start))
        return gx === undefined
          ? undefined
          : {
              mx: left + (i + 0.5) * columnWidth,
              gx,
              label: typeof data.name === 'string' ? data.name : undefined,
            }
      })
    },
  }
}

export function matrixConnectorLineViews(
  self: ReturnType<typeof matrixColumnGeometryViews> &
    ReturnType<typeof matrixColumnViews>,
) {
  return {
    /**
     * #getter
     * The connector lines that draw: those with a genomic x.
     */
    get connectorLineCoords(): ConnectorCoord[] {
      return self.connectorCoordsByColumn.filter(coord => coord !== undefined)
    },
    /**
     * #method
     * The connector for the column under `screenX` (the crosshair), or
     * undefined off the ends and over a column with no genomic x.
     */
    connectorLineAtScreenX(screenX: number): ConnectorCoord | undefined {
      const { n, columnWidth, left } = self.columnGeometry
      const screenCol = Math.floor((screenX - left) / columnWidth)
      return screenCol >= 0 && screenCol < n
        ? self.connectorCoordsByColumn[screenCol]
        : undefined
    },
  }
}
