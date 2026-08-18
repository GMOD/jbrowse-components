import path from 'node:path'
import { pathToFileURL } from 'node:url'

// A location node is `{ uri }` and at most the two keys that travel with it.
// Anything else carrying a `uri` is a shorthand — an adapter (`{ type, uri }`)
// or the flat assembly form (`{ name, uri }`) — whose `uri` is consumed by an
// expander in the renderer that derives the canonical location keys and every
// sibling index from it. Same rule, and same reason, as localFiles.ts.
const LOCATION_KEYS = new Set(['uri', 'baseUri', 'locationType'])

// `sequence: { adapter: { uri } }` is the one shorthand that carries no second
// key, so it is indistinguishable from a location node by shape alone. The key
// it hangs off is what tells them apart, and it is the only such case: every
// other adapter shorthand names its `type`, and a location always sits on a
// `*Location` or `location` key.
function isLocationNode(record: Record<string, unknown>, parentKey?: string) {
  return (
    parentKey !== 'adapter' &&
    Object.keys(record).every(key => LOCATION_KEYS.has(key))
  )
}

// A hand-written config.json opened from disk may point at sibling data files
// by relative path (e.g. `{ "uri": "data.bam" }`). Desktop can only read local
// files as a `localPath` — a bare `uri` has no base to resolve against and
// cannot fetch a local file — so rewrite each scheme-less `uri` into a
// `localPath` resolved against the config's own directory. URIs that carry a
// scheme (http:, file:, data:) or an explicit `baseUri` (a web/hub config whose
// relative URIs resolve against that base) are left untouched.
//
// A shorthand's `uri` gets a `baseUri` of the config's directory instead of the
// rewrite. Replacing it would take the shorthand with it: `{ type: 'BamAdapter',
// uri }` would become an adapter with no `bamLocation` at all, because
// normalizeSnapshot keys on `uri` and would find none — an empty track and
// nothing logged. The expanders carry `baseUri` down onto every location they
// build, so the file and its derived `.bai`/`.fai`/`.gzi` all resolve against
// the config, and openLocation reads the resulting file: URI as a local path.
export function relativeUrisToLocalPaths(
  node: unknown,
  configDir: string,
  parentKey?: string,
): void {
  if (!node || typeof node !== 'object') {
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      relativeUrisToLocalPaths(item, configDir, parentKey)
    }
    return
  }
  const obj = node as Record<string, unknown>
  const uri = obj.uri
  // Require >=2 chars before the colon so a Windows drive letter (C:\data.bam)
  // is resolved as a local path, not mistaken for a scheme like http:/file:/data:
  const hasScheme = typeof uri === 'string' && /^[a-z][a-z0-9+.-]+:/i.test(uri)
  if (typeof uri === 'string' && !hasScheme && obj.baseUri === undefined) {
    if (isLocationNode(obj, parentKey)) {
      obj.localPath = path.resolve(configDir, uri)
      obj.locationType = 'LocalPathLocation'
      delete obj.uri
    } else {
      // trailing separator so the directory itself is the base, rather than its
      // last segment being replaced by the relative uri
      obj.baseUri = pathToFileURL(`${configDir}${path.sep}`).href
    }
  }
  // recurse regardless: an adapter can carry a shorthand `uri` AND a nested
  // location (e.g. a BAM's `uri` plus its `index.location.uri`)
  for (const [key, value] of Object.entries(obj)) {
    relativeUrisToLocalPaths(value, configDir, key)
  }
}
