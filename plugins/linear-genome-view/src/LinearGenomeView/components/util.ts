import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export function dedupe(
  results: BaseResult[] = [],
  cb: (result: BaseResult) => string,
) {
  return results.filter(
    (elt, idx, self) => idx === self.findIndex(t => cb(t) === cb(elt)),
  )
}
