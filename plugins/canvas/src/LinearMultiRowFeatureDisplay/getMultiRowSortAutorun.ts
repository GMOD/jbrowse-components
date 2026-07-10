import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface SortAutorunSelf extends IAnyStateTreeNode {
  sortRowsBy?: { refName: string; pos: number }
  loadedRegions: {
    values: () => Iterable<{ refName: string; start: number; end: number }>
  }
  setSortRowsBy: (arg?: { refName: string; pos: number }) => void
  sortRowsByValueAt: (refName: string, pos: number) => void
}

// Declarative one-shot counterpart to the right-click "Sort rows by value here"
// (same launch-spec pattern as getMultiRowClusterAutorun / LinearGenomeView
// `init`): a session/figure sets `sortRowsBy`, and the sort applies as soon as
// the region containing that position is loaded — then the flag clears so a
// saved session never re-triggers it (the resulting `layout` persists). Gating
// on the region being loaded matters: sorting before the features at `pos`
// arrive would be a silent no-op that then cleared the flag.
export function getMultiRowSortAutorun(self: SortAutorunSelf) {
  addDisposer(
    self,
    autorun(() => {
      const s = self.sortRowsBy
      if (!s) {
        return
      }
      const loaded = [...self.loadedRegions.values()].some(
        r => r.refName === s.refName && r.start <= s.pos && s.pos < r.end,
      )
      if (!loaded) {
        return
      }
      self.sortRowsByValueAt(s.refName, s.pos)
      if (isAlive(self)) {
        self.setSortRowsBy(undefined)
      }
    }),
  )
}
