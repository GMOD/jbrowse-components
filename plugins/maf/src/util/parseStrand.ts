/** MAF strand token → +1/-1. Any token other than '-' is forward (+1); MAF
 *  strand is never 0. */
export function parseStrand(token: string | undefined): 1 | -1 {
  return token === '-' ? -1 : 1
}

/** MAF states a `-` row's start against its source's reverse complement. */
export function otherStrandStart(
  srcSize: number,
  srcStart: number,
  size: number,
) {
  return srcSize - srcStart - size
}
