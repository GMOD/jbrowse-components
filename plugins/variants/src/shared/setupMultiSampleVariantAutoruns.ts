import {
  setupRunClusteringAutorun,
  setupTreeDrawingAutorun,
} from '@jbrowse/tree-sidebar'

import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type Self = IStateTreeNode &
  ReducedModel &
  Parameters<typeof getMultiSampleVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeDrawingAutorun>[0] &
  Parameters<typeof setupRunClusteringAutorun>[0]

export function setupMultiSampleVariantAutoruns(self: Self) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)

  // The "Cluster rows by genotype" flavor of the shared declarative-clustering
  // autorun: fires once on `runClustering: true` and runs the real
  // genotype-matrix RPC over whatever the installer resolved -- the
  // `clusterRegion` locus if the session named one, the visible blocks if not.
  //
  // `clusteringReady` (from ReducedModel) is the gate both clustering entry
  // points share: phased mode needs `sampleInfo`, which only a landed fetch
  // supplies, so "sources exist" is not enough here the way it is for the
  // other two flavors.
  //
  // The row count is the other half, and it is this autorun's alone to state —
  // the dialog can't be opened below two samples because the menu row that
  // opens it is disabled there. Without it a session naming `runClustering`
  // spent a whole genotype-matrix pass to hand back a one-leaf dendrogram, on
  // exactly the track the menu refuses. Same list the menu counts, so the two
  // answers cannot disagree, and the same place the multi-row and multi-wiggle
  // displays put theirs.
  setupRunClusteringAutorun(self, {
    name: 'AutoRunMultiSampleVariantClustering',
    ready: () =>
      self.clusteringReady && (self.sourcesWithoutLayout?.length ?? 0) > 1,
    run: async args => {
      const { runGenotypeClustering } =
        await import('./runGenotypeClustering.ts')
      await runGenotypeClustering({ model: self, ...args })
    },
  })
}
