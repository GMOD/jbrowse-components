// The two halves of "order the rows by what each carries at one genomic
// column", shared by every display with a "Sort rows by ... here" row.
//
// Which value is read is the display's own — multi-wiggle takes the score at
// the base, the multi-row feature display the color painted there — and stays
// there. What is here is the part that is the same question whichever value it
// is, and that both displays had answered separately and slightly differently.

// Just the span, so this takes a `Region` or anything narrower without dragging
// the assembly in.
export interface LoadedRegionSpan {
  refName: string
  start: number
  end: number
}

/**
 * Whether this region's span covers the column.
 *
 * One predicate rather than the same three comparisons written per caller,
 * because the gate and the sort have to agree exactly: `setupRowSortAutorun`
 * waits for a region satisfying this and only then clears `sortRowsBy`, so a
 * sort that answered the question differently would be dispatched into,
 * decline, and have its trigger cleared anyway — the failure the autorun's
 * refName normalization already exists to prevent, one step further along.
 */
export function regionCoversColumn(
  region: LoadedRegionSpan | undefined,
  refName: string,
  pos: number,
) {
  return (
    region !== undefined &&
    region.refName === refName &&
    region.start <= pos &&
    pos < region.end
  )
}

/**
 * The displayedRegionIndex of the loaded region covering the column, or
 * undefined when none does.
 *
 * **A caller with no answer here must leave the rows alone**, rather than
 * sorting against whatever it has. A column no loaded region covers gives every
 * row the same "no value", which ranks them all equally and writes back the
 * order they were already in — a sort that reads as having silently done
 * nothing, and that still costs a `layout` write. Scanning every region on the
 * refName instead is the near-miss: coordinates repeat across regions only by
 * refName, so two loaded windows on one contig would both answer and the
 * winner would be whichever the map iterated last.
 */
export function loadedRegionIndexAt(
  loadedRegions: { entries: () => Iterable<[number, LoadedRegionSpan]> },
  refName: string,
  pos: number,
) {
  for (const [index, region] of loadedRegions.entries()) {
    if (regionCoversColumn(region, refName, pos)) {
      return index
    }
  }
  return undefined
}

// What the shell below reads off the display: the loaded spans it resolves the
// column against, the rows it orders, and the one channel a new order is written
// through.
export interface RowSortColumnHost<S> {
  loadedRegions: { entries: () => Iterable<[number, LoadedRegionSpan]> }
  // `editableSources`, never `sources`: layout-merged (so a user's colors
  // survive the reorder) and unfiltered by the subtree, so a focused clade
  // doesn't persist itself as the whole row order and drop everything it was
  // hiding.
  editableSources: S[]
  setLayout: (rows: S[]) => void
}

/**
 * The whole of "sort rows by ... here" except the value each row carries, which
 * stays the display's (`dataAt` names the payload, `order` reads it).
 *
 * Declines twice, and neither is a no-op. A column no loaded region covers has
 * no value to sort by at all — see `loadedRegionIndexAt`. And fewer than two
 * rows has nothing to order, but `setLayout` drops the cluster tree whenever the
 * row set changes, so an adapter that reported no sources for the loaded region
 * would trade a dendrogram for an empty layout. The right-click item is gated on
 * the same count already; the declarative `sortRowsBy` entry point is not, and
 * lands here.
 */
export function sortRowsAtColumn<S extends { name: string }, D>(
  self: RowSortColumnHost<S>,
  refName: string,
  pos: number,
  dataAt: (regionIndex: number) => D | undefined,
  order: (sources: S[], data: D) => S[],
) {
  const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
  const data = index === undefined ? undefined : dataAt(index)
  if (data !== undefined && self.editableSources.length > 1) {
    self.setLayout(order(self.editableSources, data))
  }
}

/**
 * Order `sources` by the value each carries at the column, newly-ranked rows
 * first and valueless rows last.
 *
 * `compare` sees only the values that are actually there, so it never has to
 * spell a "missing" case — that rule is here, once, because it is the one both
 * displays wrote a paragraph about and it is easy to get subtly wrong. Giving a
 * missing row a neutral value instead (0, or the numeric zero of whatever the
 * value packs to) ranks it above every negative score and in the middle of
 * every color block.
 *
 * Stable throughout: rows with equal values keep their incoming order, and so
 * do the valueless ones. That is what lets an earlier sort survive inside each
 * block a later one produces, and what makes `rowGroups`' contiguous blocks
 * still ordered by whatever was sorted on.
 *
 * Returns the rows themselves rather than their names, so the caller writes the
 * result straight to `layout` — the rows it is handed are already
 * layout-merged, and a name round-trip would only re-look-up what it had.
 */
export function orderRowsByValueAt<T extends { name: string }, V>(
  sources: T[],
  valueByName: ReadonlyMap<string, V>,
  compare: (a: V, b: V) => number,
): T[] {
  return sources
    .map((source, idx) => ({
      source,
      idx,
      value: valueByName.get(source.name),
    }))
    .sort((a, b) => {
      if (a.value === undefined || b.value === undefined) {
        // both missing falls through to the index tiebreak, which is what keeps
        // the valueless tail in its incoming order
        return a.value === b.value
          ? a.idx - b.idx
          : a.value === undefined
            ? 1
            : -1
      }
      return compare(a.value, b.value) || a.idx - b.idx
    })
    .map(x => x.source)
}
