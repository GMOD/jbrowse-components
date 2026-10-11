const ASSEMBLY = '{assembly}'

export function patternNamesTrack(
  entries: readonly string[],
  trackId: string,
  assemblyNames: readonly string[],
) {
  return entries.some(
    entry =>
      entry.includes(ASSEMBLY) &&
      assemblyNames.some(name => entry.replaceAll(ASSEMBLY, name) === trackId),
  )
}
