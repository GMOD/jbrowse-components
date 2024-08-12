import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export interface Option {
  group?: string
  result: BaseResult
}

// filter so don't need re-filtering
function filterOptions(options: Option[], searchQuery: string) {
  return options.filter(
    ({ result }) =>
      result.getLabel().toLowerCase().includes(searchQuery) ||
      result.matchedObject,
  )
}

// the logic of this method is to only apply a filter to RefSequenceResults
// because they do not have a matchedObject. the trix search results already
export function getFiltered(opts: Option[], inputValue: string) {
  const filtered = filterOptions(opts, inputValue.toLocaleLowerCase())
  return [
    ...filtered.slice(0, 100),
    ...(filtered.length > 100
      ? [
          {
            group: 'limitOption',
            result: new BaseResult({
              label: 'keep typing for more results',
            }),
          },
        ]
      : []),
  ]
}

export function aggregateResults(results: BaseResult[]) {
  const m: Record<string, BaseResult[]> = {}

  for (const result of results) {
    const displayString = result.getDisplayString()
    if (!m[displayString]) {
      m[displayString] = []
    }
    m[displayString].push(result)
  }
  return m
}

export function getDeduplicatedResult(results: BaseResult[]) {
  return Object.entries(aggregateResults(results)).map(
    ([displayString, results]) =>
      results.length === 1
        ? {
            result: results[0]!,
          }
        : {
            // deduplicate a "multi-result"
            result: new BaseResult({
              displayString,
              results,
              label: displayString,
            }),
          },
  )
}
