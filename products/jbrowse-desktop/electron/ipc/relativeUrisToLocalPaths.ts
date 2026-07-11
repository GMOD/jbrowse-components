import path from 'node:path'

// A hand-written config.json opened from disk may point at sibling data files
// by relative path (e.g. `{ "uri": "data.bam" }`). Desktop can only read local
// files as a `localPath` — a bare `uri` has no base to resolve against and
// cannot fetch a local file — so rewrite each scheme-less `uri` into a
// `localPath` resolved against the config's own directory. URIs that carry a
// scheme (http:, file:, data:) or an explicit `baseUri` (a web/hub config whose
// relative URIs resolve against that base) are left untouched.
export function relativeUrisToLocalPaths(
  node: unknown,
  configDir: string,
): void {
  if (!node || typeof node !== 'object') {
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      relativeUrisToLocalPaths(item, configDir)
    }
    return
  }
  const obj = node as Record<string, unknown>
  const uri = obj.uri
  const hasScheme = typeof uri === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(uri)
  if (typeof uri === 'string' && !hasScheme && obj.baseUri === undefined) {
    obj.localPath = path.resolve(configDir, uri)
    obj.locationType = 'LocalPathLocation'
    delete obj.uri
  }
  // recurse regardless: an adapter can carry a shorthand `uri` AND a nested
  // location (e.g. a BAM's `uri` plus its `index.location.uri`)
  for (const key of Object.keys(obj)) {
    relativeUrisToLocalPaths(obj[key], configDir)
  }
}
