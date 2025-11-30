import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function sortConfs(
  confs: AnyConfigurationModel[],
  sortNames: boolean,
  sortCategories: boolean,
) {
  // uses readConfObject instead of getTrackName so that the undefined
  // reference sequence track is sorted to the top
  const ret = confs.map(c => [
    c,
    readConfObject(c, 'name'),
    readConfObject(c, 'category')?.[0] || '',
    readConfObject(c, 'category')?.[1] || '',
    readConfObject(c, 'category')?.[2] || '',
  ])
  if (sortNames) {
    ret.sort((a, b) => a[1].localeCompare(b[1]))
  }
  if (sortCategories) {
    // sort up to three sub-category levels, harder to code it to go deeper
    // than this and likely rarely used
    ret.sort((a, b) => {
      if (a[2] !== b[2]) {
        return a[2].localeCompare(b[2])
      } else if (a[3] !== b[3]) {
        return a[3].localeCompare(b[3])
      } else if (a[4] !== b[4]) {
        return a[4].localeCompare(b[4])
      }
      return 0
    })
  }
  return ret.map(a => a[0])
}
