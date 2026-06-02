import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

type SortKey = [
  conf: AnyConfigurationModel,
  name: string,
  cat0: string,
  cat1: string,
  cat2: string,
]

export function sortConfs(
  confs: AnyConfigurationModel[],
  sortNames: boolean,
  sortCategories: boolean,
) {
  if (!sortNames && !sortCategories) {
    return confs
  }
  // Pre-compute sort keys once to avoid O(n log n) readConfObject calls in comparator.
  // uses readConfObject instead of getTrackName so that the undefined
  // reference sequence track sorts to the top
  const keyed: SortKey[] = confs.map(c => {
    const category =
      (readConfObject(c, 'category') as string[] | undefined) ?? []
    return [
      c,
      String(readConfObject(c, 'name') ?? ''),
      category[0] ?? '',
      category[1] ?? '',
      category[2] ?? '',
    ]
  })
  if (sortNames) {
    keyed.sort((a, b) => a[1].localeCompare(b[1]))
  }
  if (sortCategories) {
    // sort up to three sub-category levels, harder to code it to go deeper
    // than this and likely rarely used
    keyed.sort((a, b) => {
      if (a[2] !== b[2]) {
        return a[2].localeCompare(b[2])
      }
      if (a[3] !== b[3]) {
        return a[3].localeCompare(b[3])
      }
      return a[4].localeCompare(b[4])
    })
  }
  return keyed.map(([conf]) => conf)
}
