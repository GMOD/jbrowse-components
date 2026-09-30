export interface LooseTrackInput {
  uri: string
  index?: string
  baseUri?: string
  [key: string]: unknown
}

/**
 * A track written as a data file with no `adapter`, the form
 * `expandLooseTrackConfig` expands.
 */
export function isLooseTrackConfig(
  snap: unknown,
): snap is LooseTrackInput & { trackId?: string } {
  return (
    typeof snap === 'object' &&
    snap !== null &&
    !Array.isArray(snap) &&
    typeof (snap as { uri?: unknown }).uri === 'string' &&
    !('adapter' in snap)
  )
}
