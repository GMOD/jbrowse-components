import { setupTreeSidebarAutoruns } from '@jbrowse/tree-sidebar'

import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type Self = IStateTreeNode &
  ReducedModel & {
    // Here rather than on `ReducedModel` for the reason stated against
    // `clusteringReady` there: that one is on the shared interface because BOTH
    // clustering entry points gate on it, and this one only this autorun does.
    autoClusterReady: boolean
    sortRowsByGenotypeAt: (refName: string, pos: number) => void
  } & Parameters<typeof getMultiSampleVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeSidebarAutoruns>[0]

export function setupMultiSampleVariantAutoruns(self: Self) {
  getMultiSampleVariantSourcesAutorun(self)

  setupTreeSidebarAutoruns(self, {
    name: 'MultiSampleVariant',
    sortRows: (refName, pos) => {
      self.sortRowsByGenotypeAt(refName, pos)
    },
    // "Cluster rows by genotype": the genotype-matrix RPC over the
    // `clusterRegion` locus if the session named one, the visible blocks if
    // not.
    //
    // `clusteringReady` (from ReducedModel) is the gate both clustering entry
    // points share: phased mode needs `sampleInfo`, which only a landed fetch
    // supplies, so "sources exist" is not enough here the way it is for the
    // other flavors.
    //
    // `autoClusterReady` is that plus the row count, which is this autorun's
    // alone to state — the dialog can't be opened below two samples because
    // the menu row that opens it is disabled there. Without the count a
    // session naming `runClustering` spent a whole genotype-matrix pass to
    // hand back a one-leaf dendrogram, on exactly the track the menu refuses.
    // Same getter the menu row counts with, so the two answers cannot
    // disagree.
    clustering: {
      ready: () => self.autoClusterReady,
      run: async args => {
        const { runGenotypeClustering } =
          await import('./runGenotypeClustering.ts')
        await runGenotypeClustering({ model: self, ...args })
      },
    },
  })
}
