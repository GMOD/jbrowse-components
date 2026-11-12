import type { BaseOptions } from './types.ts'

/**
 * #api
 * One row an adapter lists: `name` is a value of the listing's field,
 * `label` and `color` are what the adapter names and colors that row with,
 * and `attributes` its other fields, such as a samples table's columns or a
 * subtrack's `group`, which never include its name, label or color.
 */
export interface ListedRowSource {
  name: string
  label?: string
  color?: string
  attributes?: Record<string, string>
}

/**
 * #api
 * Every row an adapter has, in the adapter's order, whatever the loaded regions hold,
 * so a row display gives a row with nothing in view its place, label and
 * color.
 */
export interface RowSourceListing {
  /** The feature field the listed names are values of: `source` on a multi-BigWig, `alignments` on a MAF, whose per-species record is keyed by them. */
  field: string
  sources: ListedRowSource[]
  /** A guide tree over the names, as Newick, where the adapter ships one. */
  tree?: string
  /** What the adapter's samples table disagreed with its rows about. */
  warnings?: string[]
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
