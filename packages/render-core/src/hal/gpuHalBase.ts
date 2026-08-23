import { OomReporter } from './oomReporter.ts'
import { RegionRegistry } from './regionRegistry.ts'

import type { PipelineDescriptor, TextureBinding } from './types.ts'

/**
 * The device ceilings the shared upload shells refuse past. WebGPU asks the
 * device, WebGL2 has no such parameter for buffers and carries its own constant
 * (see `MAX_VERTEX_BUFFER_BYTES`), and `MockHal` has none at all.
 */
export interface HalLimits {
  maxBufferBytes: number
  maxTextureDimensionPx: number
}

/**
 * The half of a HAL that is not per-backend: the descriptor map, the
 * `(region, pass)` buffer registry and the upload/delete semantics over it, the
 * over-limit refusals and their wording, and the once-only `dispose` guard.
 *
 * `packages/render-core/CLAUDE.md` states HAL parity as a rule ("a behavior
 * change to one HAL lands in the other and in `MockHal`"); this class is the
 * structural half of it. What stays in the leaves is what genuinely differs —
 * the frame bracket, uniform ring vs UBO, scissor Y-flip, MSAA, lazy vs eager
 * pipeline build, and WebGPU's deferred destroy, which the `destroyBuffer` hook
 * keeps WebGPU's alone.
 *
 * A backend's `Buf` carries its own leaf handle plus the instance `count` every
 * caller reads through `getBufferCount`.
 */
export abstract class GpuHalBase<Buf extends { count: number }> {
  protected descriptors: Map<string, PipelineDescriptor>
  protected regions: RegionRegistry<Buf>
  protected oom: OomReporter

  // Guards dispose() against double invocation (pagehide + React cleanup can
  // both fire).
  protected disposed = false

  constructor(descriptors: PipelineDescriptor[], halName: string) {
    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
    this.oom = new OomReporter(halName)
    this.regions = new RegionRegistry<Buf>(buf => {
      this.destroyBuffer(buf)
    })
  }

  protected abstract limits(): HalLimits

  protected abstract createBuffer(
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ): Buf

  protected abstract destroyBuffer(buf: Buf): void

  /**
   * Replace the texture bound to `passId`, releasing whatever was there. Only
   * reached for a pass that declares a binding, and only within
   * `maxTextureDimensionPx`.
   */
  protected abstract createTexture(
    passId: string,
    binding: TextureBinding,
    data: Uint8Array,
    width: number,
    height: number,
  ): void

  /** Release this HAL's own GPU objects. Runs exactly once, from `dispose`. */
  protected abstract releaseResources(): void

  setErrorHandler(handler: (error: Error) => void) {
    this.oom.setHandler(handler)
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    // The prior buffer goes before the count is looked at, which is what makes
    // an empty upload the release rather than a no-op.
    this.regions.deleteBuffer(regionKey, passId)
    if (count > 0) {
      const { maxBufferBytes } = this.limits()
      if (data.byteLength > maxBufferBytes) {
        this.oom.report(
          `This region has too much data to render on this GPU — zoom in. (vertex buffer ${data.byteLength} bytes exceeds the ${maxBufferBytes}-byte limit)`,
        )
      } else {
        this.regions.set(regionKey, passId, this.createBuffer(data, count))
      }
    }
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey, passId)?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.regions.deleteBuffer(regionKey, passId)
  }

  deleteRegion(regionKey: number) {
    this.regions.deleteRegion(regionKey)
  }

  pruneRegions(active: Iterable<number>) {
    this.regions.prune(active)
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    // Read the binding off the descriptor, so a pass with no texture is
    // answered without touching the backend's pipeline state at all.
    const binding = this.descriptors.get(passId)?.textures?.[0]
    if (binding) {
      const { maxTextureDimensionPx } = this.limits()
      if (width > maxTextureDimensionPx || height > maxTextureDimensionPx) {
        this.oom.report(
          `This region is too large to render on this GPU — zoom in. (texture ${width}×${height} exceeds max texture size ${maxTextureDimensionPx})`,
        )
      } else {
        this.createTexture(passId, binding, data, width, height)
      }
    }
  }

  dispose() {
    if (!this.disposed) {
      this.disposed = true
      this.releaseResources()
    }
  }
}
