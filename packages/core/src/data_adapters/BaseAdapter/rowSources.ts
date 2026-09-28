import type { BaseOptions } from './types.ts'

/**
 * #api
 * One row an adapter lists: `name` is a value of the listing's field, and
 * `label` and `color` are what the adapter names and colours that row with.
 */
export interface ListedRowSource {
  name: string
  label?: string
  color?: string
}

/**
 * #api
 * Every row an adapter has, in its own order, whatever the loaded regions hold,
 * so a row display gives a row with nothing in view its place, label and
 * colour.
 */
export interface RowSourceListing {
  /** The feature field the listed names are values of: `source` on a multi-BigWig, `alignments` on a MAF, whose per-species record is keyed by them. */
  field: string
  sources: ListedRowSource[]
  /** A guide tree over the names, as Newick, where the adapter ships one. */
  tree?: string
}

/**
 * #api
 * An adapter that lists its rows without reading a region: a multi-BigWig its
 * files, a MAF its species.
 */
export interface RowSourceLister {
  listRowSources(opts?: BaseOptions): Promise<RowSourceListing>
}

/**
 * #api
 * Whether an adapter implements {@link RowSourceLister}.
 */
export function listsRowSources(adapter: object): adapter is RowSourceLister {
  return (
    typeof (adapter as Partial<RowSourceLister>).listRowSources === 'function'
  )
}
