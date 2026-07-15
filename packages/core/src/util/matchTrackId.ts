/**
 * Test whether a model's `trackId` matches any of the given patterns. Pass a
 * `RegExp` to loosely match session copies of a track, which get a timestamp
 * suffix appended to the original id (see {@link makeTrackId} /
 * {@link copyTrackSnapshot}) — an exact string compare would miss them. Handy
 * for scoping `Core-extraFeaturePanel` / `Core-replaceWidget` callbacks to a
 * track.
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
