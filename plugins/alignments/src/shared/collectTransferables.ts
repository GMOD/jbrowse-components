/**
 * Walks the worker result object and collects every ArrayBuffer plus the
 * underlying buffer of every TypedArray field. The Set dedupes in case any
 * fields share an underlying buffer (e.g. via subarray()).
 *
 * Making transferables derived rather than maintained closes the entire class
 * of "added a TypedArray field, forgot to transfer it" bugs that the
 * pileup/chain executors are otherwise prone to.
 */
export function collectResultTransferables(result: object) {
  const buffers = new Set<ArrayBuffer>()
  for (const value of Object.values(result)) {
    if (value instanceof ArrayBuffer) {
      buffers.add(value)
    } else if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer as ArrayBuffer)
    }
  }
  return [...buffers]
}
