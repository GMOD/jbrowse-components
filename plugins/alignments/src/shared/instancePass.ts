import { slangPass } from '@jbrowse/render-core/slangPass'

import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { SlangPassOpts } from '@jbrowse/render-core/slangPass'

/**
 * A shader pass bundled with the function that packs its instance buffer.
 *
 * The pass id and the packer used to be stated in two files — `packGpu.ts`
 * exported `PASS_X` and `packX`, `uploadGpu.ts` restated `PASS_X` to upload
 * what `packX` returned — and a third file mapped a layer id to the first and a
 * layer id to the second. Nothing forced the two maps to agree; a test checked
 * that they did. Here they are one object, so the correspondence isn't checked,
 * it's spelled once.
 *
 * `TData` is the pass's own narrow payload (`GapUploadData`, not the whole
 * `PileupDataResult`), and stays narrow: a registry keyed on the wide payload
 * accepts a narrow packer by contravariance, so declaring the fields a feature
 * actually reads costs nothing at the point of use.
 */
export interface InstancePass<TData> extends PassDescriptor {
  pack: (data: TData) => ArrayBuffer
}

export function instancePass<TData>(
  opts: SlangPassOpts & { pack: (data: TData) => ArrayBuffer },
): InstancePass<TData> {
  return { ...slangPass(opts), pack: opts.pack }
}

/**
 * Pack a pass's instances for one region and hand them to the HAL.
 *
 * **The instance count is the buffer's own**, not a second expression agreeing
 * with it. The HAL multiplies the count by the stride to find the last
 * instance, so a count past `byteLength / stride` reads off the end — undefined
 * pixels, no throw. Every packer allocates `n * INSTANCE_STRIDE_BYTES` and the
 * upload tier used to recompute `n` from the source arrays
 * (`gapPositions.length / 2`, `curvedArcCount(data)`, `snpPositions.length`);
 * those two expressions were free to disagree, and for the five coverage passes
 * they are evaluated on opposite sides of the RPC boundary — the worker sizes
 * the bytes, the main thread counted a parallel array.
 *
 * A zero-instance pass is skipped rather than uploaded empty, which is what
 * lets `endUpload` sweep the buffer of a pass whose data went away.
 */
export function uploadPass<TData>(
  hal: GpuHal,
  regionKey: number,
  pass: InstancePass<TData>,
  data: TData,
) {
  const buf = pass.pack(data)
  const count = buf.byteLength / pass.instanceStride
  if (!Number.isInteger(count)) {
    // Unreachable from a packer that allocates through the shader's own
    // `INSTANCE_STRIDE_BYTES`. Reachable if a worker-packed buffer was built
    // against a stride that has since drifted — the coverage passes are packed
    // in `@jbrowse/alignments-core`, which has a codegen target of its own
    // because it can't import the plugin that owns the `.slang`. Loud beats a
    // fractional instance count reaching the HAL.
    throw new Error(
      `pass ${pass.id}: ${buf.byteLength} bytes is not a whole number of ` +
        `${pass.instanceStride}-byte instances`,
    )
  }
  if (count > 0) {
    hal.uploadBuffer(regionKey, pass.id, buf, count)
  }
}
