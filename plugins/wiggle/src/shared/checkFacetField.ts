// What `facet` cannot mean on a quantitative display, refused where the config
// is read rather than where the rows are laid out. `source` is the one field a
// quantitative row can be: a wiggle carries a score per base and a subtrack
// name, and nothing else to section on. `group` — one section per adapter
// group, its subtracks overlaid inside — is the next value, which is why this
// is a facet and not a boolean.
export function checkFacetField(snap: Record<string, unknown>) {
  const facet = snap.facet as string | { field?: unknown } | undefined
  const declared = typeof facet === 'string' ? facet : facet?.field
  const field = typeof declared === 'string' ? declared : ''
  if (field && field !== 'source') {
    throw new Error(
      `facet.field is "${field}", and a quantitative display sections on "source" alone — one row per subtrack`,
    )
  }
  return snap
}
