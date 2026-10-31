/** MAF strand token → +1/-1. Any token other than '-' is forward (+1); MAF
 *  strand is never 0. */
export function parseStrand(token: string | undefined): 1 | -1 {
  return token === '-' ? -1 : 1
}

/**
 * A row's start on the other strand. MAF states a `-` row's start against the
 * reverse complement of its source, so turning a block over re-expresses each
 * row through its own source size and aligned base count.
 */
export function otherStrandStart(
  srcSize: number,
  srcStart: number,
  size: number,
) {
  return srcSize - srcStart - size
}
