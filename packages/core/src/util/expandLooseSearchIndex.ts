/**
 * Fill in what a search index written short leaves out: `type` from a `uri`
 * naming a `.ix`, which is what `jbrowse text-index` writes, and
 * `assemblyNames` from the caller — the track's own for a per-track index, or a
 * config's only assembly. A key already written is kept.
 */
export function expandLooseSearchIndex<T>(snap: T, assemblyNames?: unknown): T {
  if (typeof snap !== 'object' || snap === null || Array.isArray(snap)) {
    return snap
  }
  const index = snap as Record<string, unknown>
  const guessType =
    index.type === undefined &&
    typeof index.uri === 'string' &&
    /\.ix$/i.test(index.uri.split(/[?#]/)[0]!)
  const fillNames =
    index.assemblyNames === undefined &&
    Array.isArray(assemblyNames) &&
    assemblyNames.length > 0
  return guessType || fillNames
    ? ({
        ...index,
        ...(guessType ? { type: 'TrixTextSearchAdapter' } : {}),
        ...(fillNames ? { assemblyNames } : {}),
      } as T)
    : snap
}
