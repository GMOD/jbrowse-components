import { canonicalizeViewRefName } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { regionCoversColumn } from './rowSortColumn.ts'

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
        // The slot is `frozen` on both displays that hold one, so the typed
        // shape is a description of what a session author is meant to write and
        // not a check on what they did. A spec naming a position and no refName
        // names no column to sort at, and reaches `canonicalizeViewRefName`,
        // which lower-cases what it is handed — so the missing half threw a
        // TypeError out of the autorun rather than declining to sort.
        if (!spec || typeof spec.refName !== 'string') {
          return
        }
        // Normalize before both the gate and the dispatch. The right-click
        // entry point hands `sortRows` a refName copied off a region, but this
        // one carries whatever a session author typed — an alias as often as
        // the assembly's own name — and everything it is about to be compared
        // against is canonical. Unnormalized, `{refName: 'chr17'}` on an
        // assembly canonicalized `17` never satisfies the gate, so the sort
        // never runs AND the flag never clears: it sits in the snapshot
        // forever, doing nothing, saying nothing.
        const refName = canonicalizeViewRefName(self, spec.refName)
        // The same predicate the sort itself resolves its region with, so the
        // gate cannot open on a column the action will decline to sort — which
        // would clear the trigger and leave the rows unsorted with nothing left
        // to re-fire it.
        const loaded = [...self.loadedRegions.values()].some(r =>
          regionCoversColumn(r, refName, spec.pos),
        )
        if (!loaded) {
          return
        }
        opts.sortRows(refName, spec.pos)
        if (isAlive(self)) {
          self.setSortRowsBy(undefined)
        }
      },
      { name: opts.name },
    ),
  )
}
