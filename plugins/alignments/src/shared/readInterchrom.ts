// Per-read flag: 1 when the mate maps to a different chromosome than the region
// being rendered, else 0. The read pass uses it to fade out the strand arrow for
// these reads, since mate direction is meaningless across chromosomes (see
// read.slang `dirMoot`). An empty mate ref ('' — unpaired or no mate) is never
// interchromosomal.
export function buildReadInterchrom(
  mateRefs: readonly string[] | undefined,
  refName: string,
  numReads: number,
): Uint8Array {
  const out = new Uint8Array(numReads)
  if (mateRefs) {
    for (let i = 0; i < mateRefs.length; i++) {
      const mateRef = mateRefs[i]
      out[i] = mateRef && mateRef !== refName ? 1 : 0
    }
  }
  return out
}
