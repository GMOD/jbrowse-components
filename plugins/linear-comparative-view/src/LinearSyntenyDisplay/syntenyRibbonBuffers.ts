import { createInstanceCache } from '@jbrowse/render-core/instanceCache'

import {
  SYNTENY_INSTANCE_CACHE,
  packClickedOutlineInstances,
} from './instanceInterleave.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export const PASS_FILL_STRAIGHT = 'fillStraight'
export const PASS_FILL_CURVE = 'fillCurve'
export const PASS_EDGE_STRAIGHT = 'edgeStraight'
export const PASS_EDGE_CURVE = 'edgeCurve'

export function fillPassOf(curves: boolean) {
  return curves ? PASS_FILL_CURVE : PASS_FILL_STRAIGHT
}

export function edgePassOf(curves: boolean) {
  return curves ? PASS_EDGE_CURVE : PASS_EDGE_STRAIGHT
}

/**
 * The lazy per-mode GPU buffers behind the synteny ribbon passes, shared by
 * the pairwise and multi-way renderers so neither keeps a copy of the
 * invalidation rules.
 *
 * Only the fill mode a track draws in lives on the GPU; a drawCurves toggle
 * re-uploads on the next frame from the packed bytes the interleave cache
 * still holds. The clicked outline is packed at render time — nothing knows
 * which feature to pack until the frame that draws it — under the EDGE pass id
 * beside the fill buffer, from the same packed bytes, so the outline traces
 * the fill exactly.
 */
export class SyntenyRibbonBuffers {
  private uploadedPass = new Map<number, string>()
  // Every field is part of the invalidation key: the two array identities
  // catch an RPC refetch and a recolor, `featureId` a new selection, `passId`
  // a drawCurves toggle.
  private outlineBuffers = new Map<
    number,
    {
      geomToken: Float32Array
      colors: Uint32Array
      featureId: number
      passId: string
      count: number
    }
  >()
  private interleaveCache = createInstanceCache(SYNTENY_INSTANCE_CACHE)

  constructor(private hal: GpuHal) {}

  /** upload the fill buffer for `curves` mode unless it is already there */
  ensureFill(key: number, curves: boolean, data: SyntenyInstanceData) {
    const passId = fillPassOf(curves)
    const prev = this.uploadedPass.get(key)
    if (prev === passId) {
      return passId
    }
    if (prev !== undefined) {
      this.hal.deleteBuffer(key, prev)
    }
    this.hal.uploadBuffer(
      key,
      passId,
      this.interleaveCache.get(key, data),
      data.instanceCount,
    )
    this.uploadedPass.set(key, passId)
    return passId
  }

  /**
   * Put the clicked feature's outline instances on the GPU, reusing what is
   * already there when nothing in the key moved. Answers whether there is
   * anything to draw: a clicked feature whose instances all live in another
   * region packs to zero, and the HAL leaves no buffer behind for an empty
   * upload.
   */
  ensureOutline(
    key: number,
    curves: boolean,
    data: SyntenyInstanceData,
    featureId: number,
  ) {
    const passId = edgePassOf(curves)
    const prev = this.outlineBuffers.get(key)
    if (
      prev &&
      prev.geomToken === data.bp1 &&
      prev.colors === data.colors &&
      prev.featureId === featureId &&
      prev.passId === passId
    ) {
      return prev.count > 0 ? passId : undefined
    }
    // A drawCurves toggle moves the outline to the other edge pass; the old
    // pass's buffer would otherwise sit on the GPU unreferenced. Same-pass
    // re-uploads need no delete — both HALs replace in place.
    if (prev && prev.passId !== passId) {
      this.hal.deleteBuffer(key, prev.passId)
    }
    const { buf, count } = packClickedOutlineInstances(
      data,
      featureId,
      this.interleaveCache.get(key, data),
    )
    this.hal.uploadBuffer(key, passId, buf, count)
    this.outlineBuffers.set(key, {
      geomToken: data.bp1,
      colors: data.colors,
      featureId,
      passId,
      count,
    })
    return count > 0 ? passId : undefined
  }

  /** a re-upload of `key`'s cell: its GPU buffers no longer describe it */
  invalidate(key: number) {
    const prev = this.uploadedPass.get(key)
    if (prev !== undefined) {
      this.hal.deleteBuffer(key, prev)
      this.uploadedPass.delete(key)
    }
    const outline = this.outlineBuffers.get(key)
    if (outline) {
      this.hal.deleteBuffer(key, outline.passId)
      this.outlineBuffers.delete(key)
    }
  }

  /** `key`'s region is gone; the caller's `deleteRegion` reclaims the GPU side */
  release(key: number) {
    this.uploadedPass.delete(key)
    this.outlineBuffers.delete(key)
    this.interleaveCache.delete(key)
  }

  clear() {
    this.uploadedPass.clear()
    this.outlineBuffers.clear()
    this.interleaveCache.clear()
  }
}
