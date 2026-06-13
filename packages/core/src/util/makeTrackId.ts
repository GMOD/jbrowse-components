/**
 * Build a track id from a track name, shared by the add-track workflows so the
 * slug rule and the `-sessionTrack` suffix convention live in one place.
 * `timestamp` defaults to now but can be pinned so a batch of tracks shares it;
 * `index` then disambiguates ids within that batch when several files share a
 * name.
 */
export function makeTrackId({
  name,
  adminMode,
  timestamp = Date.now(),
  index,
}: {
  name: string
  adminMode: boolean
  timestamp?: number
  index?: number
}) {
  const slug = name.trim().toLowerCase().replaceAll(' ', '_')
  const suffix = index === undefined ? '' : `-${index}`
  return `${slug}-${timestamp}${suffix}${adminMode ? '' : '-sessionTrack'}`
}
