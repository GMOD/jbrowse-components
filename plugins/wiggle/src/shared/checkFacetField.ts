// What `facet` cannot mean on a quantitative display, refused where the config
// is read rather than where the rows are laid out. `source` is the one field a
// quantitative row can be: a wiggle carries a score per base and a subtrack
// name, and nothing else to section on. `group` — one section per adapter
// group, its subtracks overlaid inside — is the next value, which is why this
// is a facet and not a boolean.
//
// Asked of a snapshot that names this display, because a track's `displays`
// union runs every candidate schema's preprocessor over every entry while it
// works out which one the snapshot is: a mark display's `facet: 'sample'` would
// otherwise be refused by the schema it was never meant for.
export function checkFacetField(displayType: string) {
  return (snap: Record<string, unknown>) => {
    const facet = snap.facet as string | { field?: unknown } | undefined
    const declared = typeof facet === 'string' ? facet : facet?.field
    const field = typeof declared === 'string' ? declared : ''
    if (field && field !== 'source' && snap.type === displayType) {
      throw new Error(
        `${displayType}: facet.field is "${field}", and a quantitative display sections on "source" alone — one row per subtrack`,
      )
    }
    return snap
  }
}
