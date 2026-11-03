export interface LooseTrackInput {
  uri: string
  index?: string
  csi?: boolean
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

/**
 * The index a loose track names: its `index`, or with `csi: true` the `.csi`
 * beside `uri`, the same switch an adapter's `uri` shorthand takes.
 */
export function looseIndexUri({
  uri,
  index,
  csi,
}: Pick<LooseTrackInput, 'uri' | 'index' | 'csi'>) {
  return csi && !index ? `${uri}.csi` : index
}
