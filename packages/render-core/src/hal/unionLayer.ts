import * as layerOverShader from '../shaders/layerOver.generated.ts'
import { slangPass } from '../slangPass.ts'

import type { PipelineDescriptor } from './types.ts'

export interface PxRect {
  x: number
  y: number
  w: number
  h: number
}

export function isUnion(desc: PipelineDescriptor) {
  return desc.blendState.op === 'union'
}

/** The pass that composites union pass `passId`'s layer, and samples it. */
export function layerOverId(passId: string) {
  return `${passId}\u0000layerOver`
}

export const LAYER_SAMPLER = 'layer'

/** The passes and, after them, one composite per union pass among them. */
export function withLayerOver(descriptors: PipelineDescriptor[]) {
  return [
    ...descriptors,
    ...descriptors
      .filter(isUnion)
      .map(d => slangPass({ id: layerOverId(d.id), mod: layerOverShader })),
  ]
}

/** The composite's one instance, for a layer `width` x `height` device px. */
export function layerOverInstance(width: number, height: number) {
  return layerOverShader.packInstances({ sizePx: [width, height] }, 1)
}

/**
 * `rect` less the end columns that an earlier composite of the frame, in
 * `done`, covered across its height. A column two blocks meeting mid-pixel
 * share is composited once: holding both blocks' ink on WebGPU, whose layer
 * renders ahead of the frame, and the first block's alone on WebGL2.
 */
export function uncomposited(rect: PxRect, done: readonly PxRect[]) {
  let left = rect.x
  let right = rect.x + rect.w
  for (const r of done) {
    if (r.y <= rect.y && r.y + r.h >= rect.y + rect.h) {
      const end = r.x + r.w
      if (r.x <= left && end > left) {
        left = Math.min(end, right)
      } else if (r.x < right && end >= right) {
        right = Math.max(r.x, left)
      }
    }
  }
  return right > left
    ? { x: left, y: rect.y, w: right - left, h: rect.h }
    : undefined
}
