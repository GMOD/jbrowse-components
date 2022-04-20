import OffscreenCanvasShim from './CanvasShim'
import OffscreenCanvasRenderingContext2DShim from './Canvas2DContextShim'
import type * as NodeCanvas from 'canvas'
import isObject from 'is-object'
import { Command } from './Canvas2DContextShim/types'

export type AbstractCanvas =
  | OffscreenCanvas
  | OffscreenCanvasShim
  | NodeCanvas.Canvas

export type Abstract2DCanvasContext =
  | OffscreenCanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2DShim

export type AbstractImageBitmap = Pick<ImageBitmap, 'height' | 'width'>

/** a plain-object (JSON) serialization of a OffscreenCanvasRenderingContext2DShim */
export interface CanvasImageDataShim {
  serializedCommands: Command[]
  containsNoTransferables: true
  height: number
  width: number
}

export function isCanvasImageDataShim(
  thing: unknown,
): thing is CanvasImageDataShim {
  return (
    isObject(thing) &&
    'height' in thing &&
    'serializedCommands' in thing &&
    Array.isArray(thing.serializedCommands)
  )
}
