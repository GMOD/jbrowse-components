import { openLocation } from '@jbrowse/core/util/io'
import { isUriLocation } from '@jbrowse/core/util/types'

import type PluginManager from '@jbrowse/core/PluginManager'
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
) {
  if (isUnconfiguredLocation(loc)) {
    return []
  }
  const text = await openLocation(loc, pluginManager).readFile('utf8')
  return text
    .split(/\n|\r\n|\r/)
    .filter(line => !!line.trim())
    .map(line => line.split('\t'))
}
