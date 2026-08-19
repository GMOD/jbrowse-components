/**
 * Test whether a `trackId` matches any of the given patterns, exactly as
 * written. A session copy of a track carries a timestamp suffix on its id (see
 * {@link makeTrackId} / {@link copyTrackSnapshot}), so a plain string misses
 * the user's copies and matching them means passing a `RegExp` yourself.
 *
 * To scope an extension point contribution to a track, use
 * `matchesTrackSelector` from `@jbrowse/core/ui` instead: it takes the same
 * patterns and normalizes the copy suffix, which is the part nobody remembers.
 */
export function matchTrackId(
  trackId: string | undefined,
  patterns: (string | RegExp)[],
) {
  return (
    trackId !== undefined &&
    patterns.some(pattern =>
      typeof pattern === 'string' ? pattern === trackId : pattern.test(trackId),
    )
  )
}
