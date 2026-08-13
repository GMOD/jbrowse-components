import { slangPass } from './slangPass.ts'

import type { GpuHal, PassDescriptor } from './hal'
import type { SlangPassOpts } from './slangPass.ts'

/**
 * A shader pass bundled with the function that packs its instance buffer.
 *
 * A pass id, the packer that fills its buffer, and the upload that joins them
 * are three statements of one fact, and renderers kept them in three places —
 * so a pass could be registered and drawn while nothing uploaded to it, which
 * paints nothing, silently, on the GPU backend only. Here they are one object.
 *
 * `TData` is the pass's own narrow payload, and stays narrow: a registry keyed
 * on a wide payload accepts a packer of a supertype by contravariance, so
 * declaring only the fields a pass actually reads costs nothing at the point of
 * use.
 */
export interface InstancePass<TData> extends PassDescriptor {
  pack: (data: TData) => ArrayBuffer | ArrayBufferView
}

export function instancePass<TData>(
  opts: SlangPassOpts & {
    pack: (data: TData) => ArrayBuffer | ArrayBufferView
  },
): InstancePass<TData> {
  return { ...slangPass(opts), pack: opts.pack }
}

/**
 * Pack a pass's instances for one region and hand them to the HAL.
 *
 * **The instance count is the buffer's own**, not a second expression agreeing
 * with it. The HAL multiplies the count by the stride to find the last
 * instance, so a count past `byteLength / stride` reads off the end —
 * undefined pixels, no throw. A packer that allocates `n * INSTANCE_STRIDE_BYTES`
 * has already stated `n`; asking it again from the source arrays
 * (`positions.length / 2`, `numInsertions`, a parallel array the worker sized
 * separately) is a second expression free to disagree.
 *
 * **A packer that over-allocates must right-size before returning** — the count
 * is read off the bytes, so trailing capacity would draw as instances. Prefer
 * the copy to a subarray view: a view pins the whole allocation, and these
 * payloads are retained per region for as long as the region is loaded.
 *
 * An empty pack is passed through rather than skipped: every HAL deletes the
 * pass's prior buffer before looking at the count, so `count === 0` IS the
 * "this pass has nothing this time" instruction, and a caller outside a
 * `beginUpload`/`endUpload` bracket needs it to be.
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
    // Unreachable from a packer sizing itself off the shader's own
    // `INSTANCE_STRIDE_BYTES`. Reachable if a buffer packed somewhere that
    // cannot import the `.slang` — a worker package with a codegen target of
    // its own — was built against a stride that has since drifted. Loud beats a
    // fractional instance count reaching the HAL.
    throw new Error(
      `pass ${pass.id}: ${buf.byteLength} bytes is not a whole number of ` +
        `${pass.instanceStride}-byte instances`,
    )
  }
  hal.uploadBuffer(regionKey, pass.id, buf, count)
}
