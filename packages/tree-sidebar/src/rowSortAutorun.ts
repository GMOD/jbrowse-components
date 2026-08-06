import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A single genomic column to order the rows by. The whole point of naming it
 * this way rather than by a loaded-region index is that a session outlives the
 * fetch that produced one.
 */
export interface RowSortSpec {
  refName: string
  pos: number
}

// Declarative one-shot counterpart to a display's right-click "Sort rows by ...
// here", following the same transient-launch-spec pattern as
// `setupRunClusteringAutorun` and LinearGenomeView's `init`: a session or figure
// sets `sortRowsBy`, the sort applies as soon as the region containing that
// position is loaded, and the flag clears so a saved session never re-triggers
// it (the `layout` it produced persists on its own).
//
// Gating on the region being loaded is the substance here. Sorting before the
// data at `pos` arrives is a silent no-op — every row reads "no value", the
// order is unchanged — and clearing the flag afterwards would make that
// permanent, so a figure would capture the unsorted rows with nothing to say
// why. The autorun reads `loadedRegions` so it re-fires when the fetch lands.
//
// Shared rather than per display because the flag, the gate and the clear are
// the same three lines whichever value the rows are being ordered by; `sortRows`
// is what differs (the multi-row feature display ranks by the color at the
// column, multi-wiggle by the score there).
export function setupRowSortAutorun(
  self: IStateTreeNode & {
    sortRowsBy?: RowSortSpec
    loadedRegions: {
      values: () => Iterable<{ refName: string; start: number; end: number }>
    }
    setSortRowsBy: (arg?: RowSortSpec) => void
  },
  opts: {
    name: string
    sortRows: (refName: string, pos: number) => void
  },
) {
  addDisposer(
    self,
    autorun(
      () => {
        const spec = self.sortRowsBy
        if (!spec) {
          return
        }
        const loaded = [...self.loadedRegions.values()].some(
          r =>
            r.refName === spec.refName &&
            r.start <= spec.pos &&
            spec.pos < r.end,
        )
        if (!loaded) {
          return
        }
        opts.sortRows(spec.refName, spec.pos)
        if (isAlive(self)) {
          self.setSortRowsBy(undefined)
        }
      },
      { name: opts.name },
    ),
  )
}
