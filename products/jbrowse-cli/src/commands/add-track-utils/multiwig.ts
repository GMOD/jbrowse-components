import fs from 'node:fs'

import { isURL } from '../../types/common.ts'

import type { Adapter, Location } from './adapter-utils.ts'

// Parse the --multiwig argument into a subadapter list, mirroring @jbrowse/img's
// --multiwig: either a comma-separated list of BigWig files/URLs, or a `.json`
// file holding an array of BigWig locations or full subadapter objects (each a
// BigWigAdapter config carrying its own name/color/group).
//
// A string entry becomes an explicit `{ type: 'BigWigAdapter', bigWigLocation }`
// subadapter — NOT an entry in the adapter's `bigWigs` string-array shorthand.
// The shorthand can only carry bare URIs and does not resolve a relative path
// against the config's baseUri, so a relative local file 404s there. Building the
// location object ourselves runs it through the same mapLocation as every other
// track file, so `--load copy --subDir bw` yields `{ uri: 'bw/a.bw' }` that
// resolves relative to config.json exactly like a single-file track.
//
// Object entries are full subadapter configs, so they pass through unchanged
// (keeping their per-row metadata) and own their own locations — use URLs or
// config-relative uris there, since --load only copies the string entries.
export function buildMultiWiggle({
  sources,
  mapLocation,
}: {
  sources: string
  mapLocation: (l: string) => Location
}): { adapter: Adapter; files: string[] } {
  const files: string[] = []
  const subadapters = parseSources(sources).map(entry => {
    if (typeof entry === 'string') {
      if (!isURL(entry)) {
        files.push(entry)
      }
      return { type: 'BigWigAdapter', bigWigLocation: mapLocation(entry) }
    }
    return entry
  })
  return {
    adapter: { type: 'MultiWiggleAdapter', subadapters },
    files,
  }
}

function parseSources(sources: string): (string | Record<string, unknown>)[] {
  if (sources.toLowerCase().endsWith('.json')) {
    const data: unknown = JSON.parse(fs.readFileSync(sources, 'utf8'))
    if (!Array.isArray(data)) {
      throw new Error(
        `${sources}: expected a JSON array of BigWig URLs or subadapter objects`,
      )
    }
    return data
  }
  return sources
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}
