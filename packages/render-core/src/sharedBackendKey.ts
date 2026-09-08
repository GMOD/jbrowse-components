/**
 * Stable 32-bit slot for a display on a backend it shares with siblings, hashed
 * from its MST node id (djb2). Collisions are vanishingly rare at display
 * cardinalities, and the alternative — coordinating integer slots between
 * displays that don't know about each other — is worse.
 *
 * Key by this, never by the display's index in its parent's list. An index
 * renumbers when a sibling is hidden or reordered, which hands the survivor a
 * slot holding another display's bytes: the keyed diff sees a changed
 * reference and re-uploads every later display's whole buffer, and any frame
 * drawn between the two mistakes one display's geometry for another's.
 *
 * It is also how a display whose own cells are named rather than numbered
 * reaches the per-region backend, whose keys are `displayedRegionIndex`: the
 * multi-way stack's gutters and lanes are one map keyed by this off each
 * layer's name.
 */
export function sharedBackendKey(id: string) {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return h >>> 0
}
