import { IntervalTree } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// `getFeatures` for an in-memory interval-tree adapter: one tree per refName,
// built once and rebuilt after a failure. `loadData` is awaited with each
// caller's opts ahead of the tree, so every fetch joins the whole-file load's
// progress rather than only the one that started it.
export function intervalTreeFeatures(
  loadData: (opts: BaseOptions) => Promise<unknown>,
  buildTree: (refName: string) => Promise<IntervalTree<Feature> | undefined>,
) {
  const trees = new Map<string, Promise<IntervalTree<Feature> | undefined>>()
  const loadTree = (refName: string) => {
    let tree = trees.get(refName)
    if (tree === undefined) {
      tree = buildTree(refName).catch((e: unknown) => {
        trees.delete(refName)
        throw e
      })
      trees.set(refName, tree)
    }
    return tree
  }
  return (query: Region, opts: BaseOptions = {}) =>
    ObservableCreate<Feature>(async observer => {
      await loadData(opts)
      const tree = await loadTree(query.refName)
      for (const f of tree?.search([query.start, query.end]) ?? []) {
        observer.next(f)
      }
      observer.complete()
    }, opts.signal)
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
