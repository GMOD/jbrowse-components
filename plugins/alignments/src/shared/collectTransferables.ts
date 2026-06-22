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
export function collectGroupedTransferables(groups: { data: object }[]) {
  const buffers = new Set<ArrayBuffer>()
  for (const group of groups) {
    addTransferables(buffers, group.data)
  }
  return [...buffers]
}
