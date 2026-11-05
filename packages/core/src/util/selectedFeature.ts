import { isFeature } from './simpleFeature.ts'

/**
 * The id of the session's selected feature when `trackId` is the track it was
 * selected from. A feature id is unique only among one track's records, so a
 * reader that skipped the track check would highlight whichever of its own
 * features happens to share the id.
 */
export function selectedFeatureIdFor(
  session: { selection?: unknown; selectionTrackId?: string },
  trackId: string,
) {
  const { selection, selectionTrackId } = session
  return isFeature(selection) && selectionTrackId === trackId
    ? selection.id()
    : undefined
}
