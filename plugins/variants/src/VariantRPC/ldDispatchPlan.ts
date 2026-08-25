export interface DispatchPlan {
  width: number
  height: number
  rowStride: number
}

// Cells are dispatched over a 2D workgroup grid, because a 1D dispatch is
// capped at maxComputeWorkgroupsPerDimension (65535) workgroups — only ~4.19M
// cells, which just ~2896 SNPs already exceeds. The kernel rebuilds the flat
// cell index as `gid.y * rowStride + gid.x`.
//
// Returns null when the work doesn't fit this device even as a 2D grid, or
// either buffer would exceed its limits; the caller then leaves the matrix to
// the CPU path rather than issuing a dispatch that would fail validation.
//
// BOTH buffers, which is new: the check weighed only the output. An oversize
// genotype buffer did still reach the CPU path, but by an accident of ordering —
// `createBuffer` runs before `pushErrorScope`, so the buffer's own validation
// error escapes the scope entirely and what the scope catches is the later
// `setBindGroup` against the invalid handle. Refusing at plan time is the same
// answer arrived at deliberately, and it is the one place that can say no
// before any buffer is allocated.
export function planLDDispatch(
  limits: {
    maxComputeWorkgroupsPerDimension: number
    maxStorageBufferBindingSize: number
    maxBufferSize: number
  },
  numCells: number,
  inputBytes: number,
  workgroupSizeX: number,
): DispatchPlan | null {
  const maxPerDim = limits.maxComputeWorkgroupsPerDimension
  const groups = Math.ceil(numCells / workgroupSizeX)
  const width = Math.min(groups, maxPerDim)
  const height = Math.ceil(groups / width)
  const outputBytes = numCells * 4
  const fitsBuffer = (bytes: number) =>
    bytes <= limits.maxStorageBufferBindingSize && bytes <= limits.maxBufferSize
  const fits =
    height <= maxPerDim && fitsBuffer(outputBytes) && fitsBuffer(inputBytes)
  return fits ? { width, height, rowStride: width * workgroupSizeX } : null
}
