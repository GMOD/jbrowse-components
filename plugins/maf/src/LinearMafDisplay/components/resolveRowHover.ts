import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MafHover } from '../util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Resolve the row hover (aligned base / insertion / bridged region) under the
 * cursor, shared by the tooltip and the pointer-cursor feedback so the two
 * always agree. `mouseY` is display-relative (the bands above the rows
 * included); callers gate the band area and drag state themselves.
 */
export function resolveMafRowHover(
  model: LinearMafDisplayModel,
  view: LinearGenomeViewModel,
  mouseX: number,
  mouseY: number,
): MafHover | undefined {
  const p2 = view.pxToBp(mouseX)
  if (p2.oob) {
    return undefined
  }
  const gposFrac = p2.reversed ? p2.end - p2.offset : p2.start + p2.offset
  const rowIndex = Math.floor(
    (mouseY + model.scrollTop - model.rowsTopOffset) / model.rowHeight,
  )
  return model.rowHoverInfo(p2.index, gposFrac, rowIndex, view.bpPerPx)
}
