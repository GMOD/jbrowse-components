export interface DistanceDispatchPlan {
  /** Columns per upload, so one slab of rows fits a storage buffer. */
  slabColumns: number
  workgroupsX: number
  workgroupsY: number
}

// 64 MB per upload: a full 1000 Genomes window is 225 MB of rows at 2504
// samples, past the 128 MB binding limit most adapters report by default, and
// the kernel accumulates across slabs so the cut costs nothing but uploads.
const SLAB_BYTES = 64 << 20

/**
 * Whether an n x n distance build fits this device, and how to cut it if so.
 * The kernel runs one thread per (i, j) over a 2D workgroup grid, so both
 * axes are capped by `maxComputeWorkgroupsPerDimension`, and the n x n output
 * has to bind as one storage buffer. Null means the matrix stays with the
 * wasm; refusing here is what keeps an oversize buffer from ever being
 * allocated.
 */
export function planDistanceDispatch(
  limits: {
    maxComputeWorkgroupsPerDimension: number
    maxStorageBufferBindingSize: number
    maxBufferSize: number
  },
  n: number,
  v: number,
  workgroup: { x: number; y: number },
): DistanceDispatchPlan | null {
  const fitsBuffer = (bytes: number) =>
    bytes <= limits.maxStorageBufferBindingSize && bytes <= limits.maxBufferSize
  const workgroupsX = Math.ceil(n / workgroup.x)
  const workgroupsY = Math.ceil(n / workgroup.y)
  const slabBytes = Math.min(
    SLAB_BYTES,
    limits.maxStorageBufferBindingSize,
    limits.maxBufferSize,
  )
  const slabColumns = Math.min(v, Math.floor(slabBytes / (4 * n)))
  const fits =
    slabColumns >= 1 &&
    fitsBuffer(n * n * 4) &&
    workgroupsX <= limits.maxComputeWorkgroupsPerDimension &&
    workgroupsY <= limits.maxComputeWorkgroupsPerDimension
  return fits ? { slabColumns, workgroupsX, workgroupsY } : null
}
