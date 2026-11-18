interface OrderedRegion {
  refName: string
  reversed?: boolean
}

/**
 * A row's whole genome in the order and orientation the row shows it now, so
 * Show whole genome keeps a Re-order chromosomes. A chromosome the row is not
 * showing goes after the ones it is, in the assembly's order.
 *
 * A row narrowed to one contig has no order to keep and takes the assembly's:
 * a search box that framed one contig is not a re-order.
 */
export function wholeGenomeInShownOrder<T extends OrderedRegion>(
  whole: readonly T[],
  shown: readonly OrderedRegion[],
) {
  const rank = new Map<string, number>()
  const reversed = new Map<string, boolean>()
  for (const region of shown) {
    if (!rank.has(region.refName)) {
      rank.set(region.refName, rank.size)
      reversed.set(region.refName, !!region.reversed)
    }
  }
  return rank.size > 1
    ? whole
        .map((region, index) => ({
          region,
          index,
          order: rank.get(region.refName) ?? rank.size,
        }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ region }) => ({
          ...region,
          reversed: reversed.get(region.refName) ?? !!region.reversed,
        }))
    : [...whole]
}
