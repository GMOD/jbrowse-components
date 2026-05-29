import { openLocation } from '@jbrowse/core/util/io'
import { isUriLocation } from '@jbrowse/core/util/types'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'

export function parseChromSizes(data: string) {
  const result: Record<string, number> = {}
  for (const line of data.split(/\r?\n|\r/)) {
    const [name, length] = line.split('\t')
    if (name && length) {
      result[name] = +length
    }
  }
  return result
}

export function refSizesToRegions(refSizes: Record<string, number>) {
  return Object.entries(refSizes).map(([refName, end]) => ({
    refName,
    start: 0,
    end,
  }))
}

export function isPlaceholderLocation(loc: FileLocation, defaultUri: string) {
  return isUriLocation(loc) && (loc.uri === '' || loc.uri === defaultUri)
}

export function readOptionalMetadata(
  loc: FileLocation,
  pm: PluginManager | undefined,
) {
  return isPlaceholderLocation(loc, '/path/to/fa.metadata.yaml')
    ? null
    : openLocation(loc, pm).readFile('utf8')
}
