// What `rows` cannot mean on a quantitative display, refused where the config
// is read rather than where the rows are laid out. `source` is the one field a
// quantitative row can be: a wiggle carries a score per base and a subtrack
// name, and nothing else to put on rows. A `facet` left over from the setting
// this replaced is refused by name, since loading it as an overlay would drop
// the rows in silence.
//
// Skipped for a snapshot naming another display, because a track's `displays`
// union runs every candidate schema's preprocessor over every entry while it
// works out which one the snapshot is: a mark display's `facet: 'source'` would
// otherwise be refused by the schema it was never meant for. A bag of settings
// headed for this display's config (`applyDisplaySettings`) names no type and
// is checked.
export function checkRowsField(displayType: string) {
  return (snap: Record<string, unknown>) => {
    if (snap.type !== undefined && snap.type !== displayType) {
      return snap
    }
    if (snap.facet !== undefined) {
      throw new Error(
        `${displayType}: \`facet\` is not a setting of the quantitative display; one row per subtrack is \`rows: "source"\``,
      )
    }
    const rows = snap.rows as string | { field?: unknown } | undefined
    const declared = typeof rows === 'string' ? rows : rows?.field
    const field = typeof declared === 'string' ? declared : ''
    if (field && field !== 'source') {
      throw new Error(
        `${displayType}: rows.field is "${field}", and a quantitative display puts "source" alone on rows — one row per subtrack`,
      )
    }
    return snap
  }
}
