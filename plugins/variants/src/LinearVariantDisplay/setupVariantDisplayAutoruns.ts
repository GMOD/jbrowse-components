import { setupTreeSidebarAutoruns } from '@jbrowse/tree-sidebar'

import { getVariantSourcesAutorun } from './getVariantSourcesAutorun.ts'

import type { ReducedModel } from '../shared/clusterModelTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type Self = IStateTreeNode &
  ReducedModel & {
    sortRowsByGenotypeAt: (refName: string, pos: number) => boolean
  } & Parameters<typeof getVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeSidebarAutoruns>[0]

export function setupVariantDisplayAutoruns(self: Self) {
  getVariantSourcesAutorun(self)

  setupTreeSidebarAutoruns(self, {
    name: 'VariantDisplay',
    // Forwarded, not swallowed: `false` is "no record at that column", which
    // the shared gate cannot ask about, and it holds `sortRowsBy` for the fetch
    // that brings one in.
    sortRows: (refName, pos) => self.sortRowsByGenotypeAt(refName, pos),
    clustering: {
      run: async args => {
        const { runGenotypeClustering } =
          await import('../shared/runGenotypeClustering.ts')
        await runGenotypeClustering({ model: self, ...args })
      },
    },
  })
}
