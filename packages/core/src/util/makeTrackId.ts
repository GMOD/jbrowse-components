/**
 * Build a track id from a track name, shared by the add-track workflows so the
 * slug rule lives in one place. `timestamp` defaults to now but can be pinned so
 * a batch of tracks shares it; `index` then disambiguates ids within that batch
 * when several files share a name. Admin-vs-session is not encoded in the id —
 * it follows from where the session stores the track (`sessionTracks` vs the
 * base config), which is also what drives the selector's "Session tracks" group
 * (see generateHierarchy).
 */
export function makeTrackId({
  name,
  timestamp = Date.now(),
  index,
}: {
  name: string
  timestamp?: number
  index?: number
}) {
  const slug = name.trim().toLowerCase().replaceAll(' ', '_')
  const suffix = index === undefined ? '' : `-${index}`
  return `${slug}-${timestamp}${suffix}`
}
