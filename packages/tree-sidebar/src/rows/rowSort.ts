import { canonicalizeViewRefName } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// "Order the rows by what each carries at one genomic column", shared by every
// display with a "Sort rows by ... here" row: the region predicate the gate and
// the sort share, the sort, and the one-shot `sortRowsBy` autorun.
//
// Which value is read is the display's own — multi-wiggle takes the score at
// the base, the multi-row feature display the color painted there — and stays
// there.

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
 * nothing, and that still costs an order write. Scanning every region on the
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
  // `arrangedRows`, never `drawnRows`: unfiltered by the subtree, so a
  // focused clade doesn't persist itself as the whole row order and drop
  // everything it was hiding.
  arrangedRows: S[]
  setRowOrder: (rows: S[]) => void
}

/**
 * The whole of "sort rows by ... here" except the value each row carries, which
 * stays the display's (`dataAt` names the payload, `order` reads it).
 *
 * Declines twice, and neither is a no-op. A column no loaded region covers has
 * no value to sort by at all — see `loadedRegionIndexAt`. And fewer than two
 * rows has nothing to order, but `setRowOrder` drops the cluster tree whenever the
 * row set changes, so an adapter that reported no rows for the loaded region
 * would trade a dendrogram for an empty layout. The right-click item is gated on
 * the same count already; the declarative `sortRowsBy` entry point is not, and
 * lands here.
 *
 * Returns whether it sorted, which is what `setupRowSortAutorun`'s `sortRows`
 * reads to decide whether to clear the trigger or leave it for a later fetch.
 *
 * **`order` is handed `arrangedRows`, which the subtree filter has not
 * touched** — the list whose order is written, not the rows on screen. So an
 * `order` that derives a STATISTIC from the row set it is given (block sizes,
 * ranks, a median) is computing it over rows a focused clade is hiding, which
 * is a different answer from the one the user is looking at. That is deliberate
 * for the ordering itself, for the reason on `RowSortColumnHost.arrangedRows`
 * — a hidden row must keep its place. A display that wants the
 * drawn set for the statistic reads its own `drawnRows` in the closure it passes
 * as `order`; nothing here can hand it over, because "which rows are drawn" is
 * downstream of decorations this module does not see.
 */
export function sortRowsAtColumn<S extends { name: string }, D>(
  self: RowSortColumnHost<S>,
  refName: string,
  pos: number,
  dataAt: (regionIndex: number) => D | undefined,
  order: (rows: S[], data: D) => S[],
) {
  const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
  const data = index === undefined ? undefined : dataAt(index)
  const sortable = data !== undefined && self.arrangedRows.length > 1
  if (sortable) {
    self.setRowOrder(order(self.arrangedRows, data))
  }
  return sortable
}

/**
 * Order `rows` by the value each carries at the column, newly-ranked rows
 * first and valueless rows last.
 *
 * `compare` sees only the values that are actually there, so it never has to
 * spell a "missing" case — that rule is here, once, because it is easy to get
 * subtly wrong. Giving a
 * missing row a neutral value instead (0, or the numeric zero of whatever the
 * value packs to) ranks it above every negative score and in the middle of
 * every color block.
 *
 * Stable throughout: rows with equal values keep their incoming order, and so
 * do the valueless ones. That is what lets an earlier sort survive inside each
 * block a later one produces.
 *
 * Returns the rows themselves rather than their names, so the caller hands the
 * result straight to `setRowOrder`.
 */
export function orderRowsByValueAt<T extends { name: string }, V>(
  rows: T[],
  valueByName: ReadonlyMap<string, V>,
  compare: (a: V, b: V) => number,
): T[] {
  return rows
    .map((row, idx) => ({
      row,
      idx,
      value: valueByName.get(row.name),
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
    .map(x => x.row)
}

/**
 * A single genomic column to order the rows by. The whole point of naming it
 * this way rather than by a loaded-region index is that a session outlives the
 * fetch that produced one.
 */
export interface RowSortSpec {
  refName: string
  pos: number
}

// Declarative one-shot counterpart to a display's right-click "Sort rows by ...
// here", following the same transient-launch-spec pattern as
// `setupRunClusteringAutorun` and LinearGenomeView's `init`: a session or figure
// sets `sortRowsBy`, the sort applies as soon as the region containing that
// position is loaded, and the flag clears so a saved session never re-triggers
// it (the order it produced persists on its own).
//
// Gating on the region being loaded is the substance here. Sorting before the
// data at `pos` arrives is a silent no-op — every row reads "no value", the
// order is unchanged — and clearing the flag afterwards would make that
// permanent, so a figure would capture the unsorted rows with nothing to say
// why. The autorun reads `loadedRegions` so it re-fires when the fetch lands.
//
// Shared rather than per display because the flag, the gate and the clear are
// the same three lines whichever value the rows are being ordered by; `sortRows`
// is what differs (the multi-row feature display ranks by an attribute it reads
// in the worker, multi-wiggle by the score at the column).
export function setupRowSortAutorun(
  self: IStateTreeNode & {
    sortRowsBy?: RowSortSpec
    loadedRegions: { values: () => Iterable<LoadedRegionSpan> }
    setSortRowsBy: (arg?: RowSortSpec) => void
  },
  opts: {
    name: string
    // `false` means the sort declined, and the trigger is left set so a later
    // fetch can re-fire it. Anything else (including a plain `void`) means it
    // ran. The gate below only knows that a region covers the column, and a
    // display can have a second reason to decline that the gate cannot ask
    // about — the multi-sample variant sort needs a RECORD at the position,
    // not merely a loaded region over it, so a session `sortRowsBy` on a
    // variant-free column sorted nothing and cleared itself.
    // A promise holds the trigger until it resolves.
    sortRows: (
      refName: string,
      pos: number,
    ) => void | boolean | Promise<boolean>
  },
) {
  addDisposer(
    self,
    autorun(
      () => {
        const spec = self.sortRowsBy
        if (!spec) {
          return
        }
        // The slot is `frozen`, so the typed shape describes what a session
        // author is meant to write, not what they did. A missing refName
        // would throw out of `canonicalizeViewRefName`, and a missing or
        // string `pos` would fail the gate below forever, so the sort would
        // never run and the flag never clear, silently.
        const badField =
          typeof spec.refName !== 'string'
            ? 'refName'
            : Number.isFinite(spec.pos)
              ? undefined
              : 'pos'
        if (badField) {
          console.warn(
            `${opts.name}: sortRowsBy.${badField} is ${JSON.stringify(spec[badField])}, not sorting`,
          )
          return
        }
        // Normalize before both the gate and the dispatch. The right-click
        // entry point hands `sortRows` a refName copied off a region, but this
        // one carries whatever a session author typed — an alias as often as
        // the assembly's own name — and everything it is about to be compared
        // against is canonical. Unnormalized, `{refName: 'chr17'}` on an
        // assembly canonicalized `17` never satisfies the gate, so the sort
        // never runs AND the flag never clears: it sits in the snapshot
        // forever, doing nothing, saying nothing.
        const refName = canonicalizeViewRefName(self, spec.refName)
        // The same predicate the sort itself resolves its region with, so the
        // gate cannot open on a column the action will decline to sort — which
        // would clear the trigger and leave the rows unsorted with nothing left
        // to re-fire it.
        const loaded = [...self.loadedRegions.values()].some(r =>
          regionCoversColumn(r, refName, spec.pos),
        )
        if (!loaded) {
          return
        }
        // Only this spec: one a session wrote while an async sort was in
        // flight is the next sort, not this one's to clear.
        const clearIfSorted = (sorted: void | boolean) => {
          if (sorted !== false && isAlive(self) && self.sortRowsBy === spec) {
            self.setSortRowsBy(undefined)
          }
        }
        const sorted = opts.sortRows(refName, spec.pos)
        if (sorted instanceof Promise) {
          void sorted.then(clearIfSorted, () => {})
        } else {
          clearIfSorted(sorted)
        }
      },
      { name: opts.name },
    ),
  )
}
