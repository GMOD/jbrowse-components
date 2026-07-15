import { IntervalTree } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// Emit the features of a per-refName interval tree that intersect the query.
// Shared by the in-memory interval-tree adapters.
export function intervalTreeFeatures(
  query: Region,
  opts: BaseOptions,
  loadTree: (refName: string) => Promise<IntervalTree<Feature> | undefined>,
) {
  return ObservableCreate<Feature>(async observer => {
    const tree = await loadTree(query.refName)
    for (const f of tree?.search([query.start, query.end]) ?? []) {
      observer.next(f)
    }
    observer.complete()
  }, opts.stopToken)
}

// Build one interval tree for a refName from paired-feature buckets, inserting
// the records that start on this ref (feats1, flip=false) and those whose mate
// starts here (feats2, flip=true). Shared by BedpeAdapter and StarFusionAdapter.
export function buildPairedIntervalTree(
  feats1: Record<string, string[]>,
  feats2: Record<string, string[]>,
  refName: string,
  idPrefix: string,
  makeFeature: (line: string, uniqueId: string, flip: boolean) => Feature,
) {
  const tree = new IntervalTree<Feature>()
  for (const [i, line] of (feats1[refName] ?? []).entries()) {
    const f = makeFeature(line, `${idPrefix}-${refName}-${i}-r1`, false)
    tree.insert([f.get('start'), f.get('end')], f)
  }
  for (const [i, line] of (feats2[refName] ?? []).entries()) {
    const f = makeFeature(line, `${idPrefix}-${refName}-${i}-r2`, true)
    tree.insert([f.get('start'), f.get('end')], f)
  }
  return tree
}
