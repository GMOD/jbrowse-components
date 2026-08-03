import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

function addFields(buffers: Set<ArrayBuffer>, obj: object) {
  for (const value of Object.values(obj)) {
    if (value instanceof ArrayBuffer) {
      buffers.add(value)
    } else if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer as ArrayBuffer)
    }
  }
}

/**
 * Every ArrayBuffer in a `MafWireRegionData`, for the RPC's transfer list.
 *
 * Without this the reply is structured-cloned, so every species' sequence is
 * copied a second time on the way out of the worker — the peak that has to fit
 * in memory is twice the alignment, right at the moment a wide region is
 * already the largest thing in flight. Transferring moves them instead.
 *
 * Derived by walking the fields rather than hand-listed, so a newly added typed
 * array can't be silently left behind to clone. The walk is bespoke because
 * MAF's buffers nest two levels down (`blocks[].rows[].alignmentBytes`), which
 * the flat `rpcResultWithArrayBuffers` helper cannot see.
 *
 * Safe to transfer: every buffer here is freshly allocated inside this RPC
 * (`TextEncoder.encode`, the coverage packers), so nothing in the worker keeps
 * a reference past the reply. The Set dedupes in case any two views ever share
 * a buffer, which `postMessage` rejects outright.
 */
export function collectMafTransferables(regionData: MafWireRegionData) {
  const buffers = new Set<ArrayBuffer>()
  addFields(buffers, regionData.coverage)
  for (const block of regionData.blocks) {
    buffers.add(block.refSeqBytes.buffer as ArrayBuffer)
    for (const row of block.rows) {
      buffers.add(row.alignmentBytes.buffer as ArrayBuffer)
    }
  }
  return [...buffers]
}
