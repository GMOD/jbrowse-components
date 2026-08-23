import { downloadPhase, fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { isUriLocation } from '@jbrowse/core/util/types'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation } from '@jbrowse/core/util/types'

// The alias adapters' `location` slots default to a "/path/to/my/..."
// placeholder; that (and a blank uri) means "no file configured", so the
// adapter yields no aliases rather than trying to fetch the placeholder path.
function isUnconfiguredLocation(loc: FileLocation) {
  return isUriLocation(loc) && (!loc.uri || loc.uri.startsWith('/path/to/my/'))
}

// Reads a tab-separated alias file into rows of columns, dropping blank lines.
// Returns [] when no file is configured.
export async function readAliasRows(
  loc: FileLocation,
  pluginManager?: PluginManager,
  opts?: BaseOptions,
) {
  if (isUnconfiguredLocation(loc)) {
    return []
  }
  // fetchAndMaybeUnzipText rather than readFile('utf8') so the read reports byte
  // progress (readFile's utf8 path takes res.text(), which can't) and so a
  // gzipped chromAlias works. UCSC's chromAlias files are the slowest of the
  // four parallel assembly loads on a big assembly, so this is the one whose
  // progress the spinner most often ends up showing
  const text = await fetchAndMaybeUnzipText(
    openLocation(loc, pluginManager),
    opts,
    downloadPhase('Downloading chromosome aliases', loc),
  )
  return text
    .split(/\n|\r\n|\r/)
    .filter(line => !!line.trim())
    .map(line => line.split('\t'))
}
