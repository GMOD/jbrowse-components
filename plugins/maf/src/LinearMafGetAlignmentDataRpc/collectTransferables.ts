import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * Every ArrayBuffer in a `MafWireRegionData`, for the RPC's transfer list.
 *
 * A flat walk of the top-level fields, which is all it needs to be now that the
 * wire is columnar: the sequence arena, the per-row/per-block columns, and the
 * coverage packers are all top-level typed arrays. The dictionaries
 * (`sampleIds`, `chrNames`) and `refSampleId` are plain values and clone.
 *
 * The length of this list is the point. It used to nest two levels down to
 * reach `blocks[].rows[].alignmentBytes` — one buffer per row, so tens of
 * thousands of entries — and `postMessage`'s per-entry cost is superlinear in
 * the list length: 86k entries blocked the worker for 3.3s in Chrome, where
 * structured-cloning the very same buffers took 159ms. Transferring only pays
 * on few, large buffers, which is exactly what columnar produces: ~20 entries
 * whatever the row count, and the same reply now costs 0.03ms.
 *
 * Derived by walking the fields rather than hand-listed, so a newly added typed
 * array can't be silently left behind to clone.
 *
 * Safe to transfer: every buffer here is freshly allocated inside this RPC (the
 * packer's arena and columns, the coverage packers), so nothing in the worker
 * keeps a reference past the reply. The Set dedupes in case any two views ever
 * share a buffer, which `postMessage` rejects outright.
 */
export function collectMafTransferables(regionData: MafWireRegionData) {
  const buffers = new Set<ArrayBuffer>()
  for (const value of [
    ...Object.values(regionData),
    ...Object.values(regionData.coverage),
  ]) {
    if (value instanceof ArrayBuffer) {
      buffers.add(value)
    } else if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
      buffers.add(value.buffer)
    }
  }
  return [...buffers]
}
