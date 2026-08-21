/**
 * What to call each genome row, one label per row. The assembly name where
 * there is one, and the row's position where a row is still loading, so a label
 * stays true whatever the assemblies turn out to be called.
 *
 * A NAME THAT REPEATS PICKS UP ITS ROW NUMBER, because a stack can hold one
 * assembly twice — two loci of the same genome, a read against its own
 * reference — and there the bare name gives two menu rows that open different
 * things under identical text. Only the repeats pay for it: the ordinary
 * pairwise view still reads "hg38" and "mm39".
 *
 * One function over the whole list rather than one row at a time, since
 * uniqueness is a property of the list. Shared by every menu that names the
 * rows — the track selectors, the row menus, the follow anchors — so they
 * cannot drift into calling the same row two different things one click apart.
 */
export function rowLabels(views: { assemblyNames: string[] }[]) {
  const names = views.map(
    (view, idx) => view.assemblyNames[0] ?? `Row ${idx + 1}`,
  )
  const counts = new Map<string, number>()
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return names.map((name, idx) =>
    counts.get(name)! > 1 ? `${name} (row ${idx + 1})` : name,
  )
}
