import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export function dedupe(results?: BaseResult[]) {
  return results?.filter(
    (elem, index, self) =>
      index === self.findIndex(t => t.getId() === elem.getId()),
  )
}
