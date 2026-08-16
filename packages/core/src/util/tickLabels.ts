/**
 * A region needs at least this many coordinate labels to be worth numbering.
 *
 * Tick pitch comes from the bpPerPx of the whole displayed-region set, so a
 * region much narrower than that pitch still catches a tick or two. With every
 * chromosome displayed at once — a whole-genome overview scalebar, a
 * whole-genome dotplot axis — each one then ends up with a single lone number
 * jammed against the next chromosome's refName, and the axis reads as scattered
 * repeats of the same "500M".
 *
 * One coordinate conveys no scale on its own: it gives a reader no spacing to
 * read a distance off, and sitting alone in a chromosome's span it reads as
 * marking that span rather than a position inside it. Needing two means narrow
 * regions show just their refName, and only regions with room for a real ruler
 * get numbers.
 */
export const MIN_TICK_LABELS_PER_BLOCK = 2

/** Whether a run of `count` coordinate labels in one region is worth drawing. */
export function tickLabelsWorthDrawing(count: number) {
  return count >= MIN_TICK_LABELS_PER_BLOCK
}

/**
 * Drop the labels of every region left with too few of them to read, keeping
 * those of regions that have a real ruler.
 *
 * For a caller holding one flat list across several regions, where the count
 * has to be taken per region before anything can be decided. A caller that
 * already works a region at a time wants `tickLabelsWorthDrawing` on its own
 * length instead.
 *
 * `regionOf` returns whatever identifies a region to the caller — an index, a
 * refName, a block key. A group's labels are dropped together, so that identity
 * has to separate two regions that can sit side by side on one axis: an axis
 * may carry the same refName twice (a read-vs-ref dotplot builds one from
 * gatherOverlaps, so a read aligned twice to a chromosome yields two regions on
 * it), and keying those together would let one lend the other its quorum.
 */
export function dropLoneTickLabels<T>(
  labels: T[],
  regionOf: (label: T) => unknown,
) {
  const counts = new Map<unknown, number>()
  for (const label of labels) {
    const region = regionOf(label)
    counts.set(region, (counts.get(region) ?? 0) + 1)
  }
  return labels.filter(label =>
    tickLabelsWorthDrawing(counts.get(regionOf(label))!),
  )
}
