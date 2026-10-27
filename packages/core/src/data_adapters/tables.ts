/**
 * What every `@jbrowse/tables` region read shares: the region a host names,
 * the default byte limit, and the refusal naming a read over it.
 */

export interface TablesRegion {
  refName: string
  start: number
  end: number
  /**
   * The contig's name in the reference, where the file spells it another
   * way (`1` in the BAM, `chr1` in the FASTA), as the browser's renamed
   * regions carry it.
   */
  originalRefName?: string
}

/**
 * The compressed bytes a read fetches before it is refused, since a host
 * holds the whole table in memory.
 */
export const DEFAULT_BYTE_LIMIT = 200_000_000

export function lociOf(regions: readonly TablesRegion[]) {
  return regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(', ')
}

/**
 * The refusal of a read whose `regions` need `bytes` of `what`, past
 * `byteLimit`. ggjbrowse parses this wording (`TOO_LARGE` in its
 * `R/engine.R`), so it changes only with that.
 */
export function overByteLimitError(
  regions: readonly TablesRegion[],
  bytes: number | undefined,
  byteLimit: number,
  what: string,
) {
  const several = regions.length > 1
  return new Error(
    `${lociOf(regions)} ${several ? 'need' : 'needs'} ${bytes} bytes of ${what}${several ? ' in total' : ''}, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
  )
}
