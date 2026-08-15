// Adds every ArrayBuffer plus the underlying buffer of every TypedArray field
// of `result` to `buffers`. The Set dedupes in case any fields share an
// underlying buffer (e.g. via subarray()).
//
// Making transferables derived rather than maintained closes the entire class
// of "added a TypedArray field, forgot to transfer it" bugs that the
// pileup/chain executors are otherwise prone to.
function addTransferables(buffers: Set<ArrayBuffer>, result: object) {
  for (const value of Object.values(result)) {
    if (value instanceof ArrayBuffer) {
      buffers.add(value)
    } else if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer as ArrayBuffer)
    }
  }
}

// Grouped result: each group carries its own PileupDataResult whose buffers
// live one level down (`group.data`), so the flat walk above can't see them.
// The Set dedupes any buffers shared across groups.
//
// **Deriving the list means transferring whatever it finds, and transferring
// MOVES.** A field that is not this call's to give away is given away anyway,
// permanently, and the symptom lands on a LATER call as "ArrayBuffer at index N
// is already detached" — for the whole fetch, with nothing naming the field.
// `positionOrder` returned a module-level empty result on a region with no
// mismatches and was detached by the first one (fixed there, in
// alignments-core); a per-call allocation on every path is what keeps this
// helper safe to point at anything.
export function collectGroupedTransferables(groups: { data: object }[]) {
  const buffers = new Set<ArrayBuffer>()
  for (const group of groups) {
    addTransferables(buffers, group.data)
  }
  return [...buffers]
}
