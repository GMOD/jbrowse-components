import type { TrackNodeSource } from './types.ts'

// sortName rather than the display name, so the unnamed reference sequence
// track sorts to the top (see trackNodeSourceFor)
export function sortSources(
  sources: TrackNodeSource[],
  sortNames: boolean,
  sortCategories: boolean,
) {
  if (!sortNames && !sortCategories) {
    return sources
  }
  const sorted = [...sources]
  if (sortNames) {
    sorted.sort((a, b) => a.sortName.localeCompare(b.sortName))
  }
  if (sortCategories) {
    // sort up to three sub-category levels, harder to code it to go deeper than
    // this and likely rarely used. Runs after the name sort and relies on
    // Array#sort being stable, so names stay ordered within a category
    sorted.sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        const d = (a.categories[i] ?? '').localeCompare(b.categories[i] ?? '')
        if (d !== 0) {
          return d
        }
      }
      return 0
    })
  }
  return sorted
}
