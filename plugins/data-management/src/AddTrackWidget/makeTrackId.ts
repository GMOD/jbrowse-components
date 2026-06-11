/**
 * Build a track id from a track name, shared by the single-track and bulk
 * add-track workflows so the slug rule and the `-sessionTrack` suffix
 * convention live in one place. `index` disambiguates ids within a single bulk
 * submission where several files share a name.
 */
export function makeTrackId({
  name,
  timestamp,
  adminMode,
  index,
}: {
  name: string
  timestamp: number
  adminMode: boolean
  index?: number
}) {
  const slug = name.toLowerCase().replaceAll(' ', '_')
  const suffix = index === undefined ? '' : `-${index}`
  return `${slug}-${timestamp}${suffix}${adminMode ? '' : '-sessionTrack'}`
}
