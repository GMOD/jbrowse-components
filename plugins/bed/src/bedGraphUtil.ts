import { SimpleFeature } from '@jbrowse/core/util'
import { getSamplesTsvSources } from '@jbrowse/core/util/samplesTsv'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation } from '@jbrowse/core/util'

// Build a single-score bedGraph feature for value column j, or undefined when
// the value is not numeric. A wide file names each value column's source in
// its header; a tidy one has a `source` column naming each row's instead.
// Shared by BedGraphAdapter and BedGraphTabixAdapter.
export function makeBedGraphFeature({
  uniqueId,
  refName,
  start,
  end,
  names,
  j,
  value,
  rowSource,
}: {
  uniqueId: string
  refName: string
  start: number
  end: number
  names: string[]
  j: number
  value: string
  rowSource?: string
}): Feature | undefined {
  const score = +value
  return Number.isNaN(score)
    ? undefined
    : new SimpleFeature({
        id: uniqueId,
        data: {
          refName,
          start,
          end,
          score,
          source: rowSource ?? (names[j] || `col${j}`),
        },
      })
}

// A tidy file's `source` column names its rows only row by row
export function wideSourceNames(names: string[]) {
  return names.length === 0 || names.includes('source')
    ? undefined
    : names.map((name, j) => name || `col${j}`)
}

export async function bedGraphSamplesTsvSources({
  location,
  names,
  pluginManager,
  opts,
}: {
  location: FileLocation | undefined
  names: string[]
  pluginManager?: PluginManager
  opts?: BaseOptions
}) {
  return location
    ? getSamplesTsvSources({
        location,
        names: wideSourceNames(names),
        namesLabel: 'the bedGraph header',
        pluginManager,
        opts,
      })
    : undefined
}
