// Import-free, so `RpcRegistry.ts` can name CoreGetContigs' wire shape
// without `util.ts` beside it pulling every adapter base class in.

export interface Contig {
  refName: string
  /** the length the file's header states, undefined where it states none */
  length?: number
  /** whether the file holds records on it, null where it cannot tell */
  hasData?: boolean | null
}

/**
 * A file's contigs as columns, which is how they cross the worker boundary:
 * structured clone copies 200,000 objects ten times slower than two arrays.
 */
export interface ContigColumns {
  refNames: string[]
  /** each refName's stated length, undefined where the file states none */
  lengths: (number | undefined)[]
}
