/**
 * A search index as a config may write it: the whole adapter config, or just
 * the `.ix` that `jbrowse text-index` wrote, as a string or as `{ uri }`.
 */
export type LooseSearchIndex =
  | string
  | { uri: string; baseUri?: string; assemblyNames?: string[] }
  | { type: string; [key: string]: unknown }

function isTrixUri(uri: string) {
  return /\.ix$/i.test(uri.split(/[?#]/)[0]!)
}

/**
 * Fill in what a search index written short leaves out: a string is its `uri`,
 * `type` comes from a `uri` naming a `.ix`, and `assemblyNames` from the caller
 * — the track's own for a per-track index, or a config's only assembly. A key
 * already written is kept.
 */
export function expandLooseSearchIndex(
  snap: unknown,
  assemblyNames?: unknown,
): unknown {
  const index = typeof snap === 'string' ? { uri: snap } : snap
  if (typeof index !== 'object' || index === null || Array.isArray(index)) {
    return snap
  }
  const entry = index as Record<string, unknown>
  const guessType =
    entry.type === undefined &&
    typeof entry.uri === 'string' &&
    isTrixUri(entry.uri)
  const fillNames =
    entry.assemblyNames === undefined &&
    Array.isArray(assemblyNames) &&
    assemblyNames.length > 0
  return guessType || fillNames || index !== snap
    ? {
        ...entry,
        ...(guessType ? { type: 'TrixTextSearchAdapter' } : {}),
        ...(fillNames ? { assemblyNames } : {}),
      }
    : snap
}
