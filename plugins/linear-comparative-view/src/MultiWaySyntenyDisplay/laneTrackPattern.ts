const ASSEMBLY = '{assembly}'

export function laneTrackIds(
  entries: readonly string[],
  spellings: readonly string[],
) {
  return [
    ...entries.filter(entry => !entry.includes(ASSEMBLY)),
    ...entries
      .filter(entry => entry.includes(ASSEMBLY))
      .flatMap(entry =>
        spellings.map(name => entry.replaceAll(ASSEMBLY, name)),
      ),
  ]
}
