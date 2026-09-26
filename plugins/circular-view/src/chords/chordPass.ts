import { types } from '@jbrowse/mobx-state-tree'
import { RenderLifecycleMixin } from '@jbrowse/render-core/RenderLifecycleMixin'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import type { ChordCell, ChordLayerFrame } from './chordMarks.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type ChordBackend = PerRegionRenderingBackend<ChordCell, ChordLayerFrame>

/** What the chord canvas reads off the circular view. */
export interface ChordPassView {
  initialized: boolean
  width: number
  height: number
  offsetRadians: number
  centerXY: [number, number]
  figureOriginXY: [number, number]
  chordRadiusPx: number
  chordScale: { radiansPerBp: number; gapRadians: number }
  chordDisplays: readonly { chordCell: ChordCell | undefined }[]
}

function sameCells(
  a: ReadonlySet<ChordCell>,
  b: ReadonlyMap<number, ChordCell>,
) {
  if (a.size !== b.size) {
    return false
  }
  for (const cell of b.values()) {
    if (!a.has(cell)) {
      return false
    }
  }
  return true
}

/**
 * The canvas every chord display of a circular view draws on: one cell per
 * display, in track order, drawn through the polar stage the frame carries. A
 * rotation or a zoom is a frame change, so it redraws and uploads nothing; a
 * cell moves only when its display's lanes do.
 */
export const ChordPass = types
  .compose('CircularChordPass', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({
    view: undefined as ChordPassView | undefined,
    /**
     * the cells the canvas last drew, so a display's frame can say its own
     * payload is on screen rather than that the canvas has drawn something
     */
    drawnCells: new Set<ChordCell>() as ReadonlySet<ChordCell>,
  }))
  .views(self => ({
    get frame(): ChordLayerFrame {
      const view = self.view!
      const [ox, oy] = view.figureOriginXY
      const [cx, cy] = view.centerXY
      return {
        canvasWidth: view.width,
        canvasHeight: view.height,
        centerX: ox + cx,
        centerY: oy + cy,
        radiansPerBp: view.chordScale.radiansPerBp,
        gapRadians: view.chordScale.gapRadians,
        offsetRadians: view.offsetRadians,
        radiusPx: view.chordRadiusPx,
      }
    },
    get cells(): ReadonlyMap<number, ChordCell> {
      const cells = new Map<number, ChordCell>()
      self.view!.chordDisplays.forEach((display, i) => {
        const cell = display.chordCell
        if (cell) {
          cells.set(i, cell)
        }
      })
      return cells
    },
    get canRender() {
      return self.view?.initialized ?? false
    },
    /** whether the canvas has drawn this cell */
    drew(cell: ChordCell) {
      return self.drawnCells.has(cell)
    },
  }))
  .actions(self => ({
    setView(view: ChordPassView) {
      self.view = view
    },
    setDrawnCells(cells: ReadonlyMap<number, ChordCell>) {
      if (!sameCells(self.drawnCells, cells)) {
        self.drawnCells = new Set(cells.values())
      }
    },
  }))
  .actions(self => ({
    startRenderingBackend(backend: ChordBackend) {
      installUpload(self, backend, {
        cells: () => self.cells,
        render: (b, cells) => {
          const { frame } = self
          const drawn = b.renderBlocks(
            canvasWideBlocks(cells.keys(), frame.canvasWidth),
            cells,
            frame,
          )
          self.setDrawnCells(cells)
          return drawn
        },
      })
    },
  }))

export interface ChordPassModel extends Instance<typeof ChordPass> {}
