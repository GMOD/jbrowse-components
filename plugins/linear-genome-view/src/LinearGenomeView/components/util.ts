import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export function dedupe(results: BaseResult[] = []) {
  return results.filter(
    (elt, idx, self) => idx === self.findIndex(t => t.getId() === elt.getId()),
  )
}
