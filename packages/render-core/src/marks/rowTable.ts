import { SPARSE_ROW_ALPHA } from '../shaders/rowTable.generated.ts'
import {
  rowTablePlaneHeight,
  rowTableTexelX,
  rowTableTexelY,
  rowTableWidth,
} from '../shaders/rowTable.js.generated.ts'

import type { MarkTexels } from './types.ts'

/** The `slot` a hidden key holds. */
export const HIDDEN_ROW = 0xffffffff

/** The `color` a key with no override holds: alpha 0, the instance's own color. */
export const NO_ROW_COLOR = 0

const MAX_SLOT = 0xffffff

/**
 * The row axis as a pass reads it: each key's drawn slot or `HIDDEN_ROW`, its
 * packed ABGR color override or `NO_ROW_COLOR`, whether its row leaves room
 * for a rect's wider floor (`sparseSpans.ts`), and the RGBA8 texture the
 * vertex stage samples for the same answers (`shaders/rowTable.slang` has the
 * layout). One object, so the shader, the painter, the ink and the hit test
 * cannot place a key differently. Immutable: a reorder, focus, hide or
 * recolor builds a new one, and the backend uploads on identity.
 */
export interface RowTable {
  readonly keys: number
  readonly slot: Uint32Array
  readonly color: Uint32Array
  /** 1 where the key's row leaves room, so a rect floors wider. */
  readonly sparse: Uint8Array
  readonly texture: MarkTexels
}

/**
 * The table for `slot[key]`, `color[key]` and `sparse[key]`, all indexed by
 * key: `slot` is `HIDDEN_ROW` where the key draws nothing, `color` is
 * `NO_ROW_COLOR` where the instance keeps its own color, an override alpha 0
 * being none, and `sparse` 1 where the key's row leaves room. The arrays are
 * held, not copied. Each key's texel sits where the shader's own twins put
 * it.
 */
export function buildRowTable(
  slot: Uint32Array,
  color: Uint32Array = new Uint32Array(slot.length),
  sparse: Uint8Array = new Uint8Array(slot.length),
): RowTable {
  const keys = slot.length
  if (color.length !== keys || sparse.length !== keys) {
    throw new Error(
      `buildRowTable: ${keys} slots but ${color.length} colors and ${sparse.length} sparse flags; all are per key`,
    )
  }
  const width = rowTableWidth(keys)
  const plane = rowTablePlaneHeight(keys)
  const bytes = new Uint8Array(width * plane * 2 * 4)
  for (let key = 0; key < keys; key++) {
    const s = slot[key]!
    const x = rowTableTexelX(key, keys)
    const y = rowTableTexelY(key, keys)
    const o = (y * width + x) * 4
    if (s !== HIDDEN_ROW) {
      if (s > MAX_SLOT) {
        throw new Error(
          `buildRowTable: slot ${s} of key ${key} exceeds the ${MAX_SLOT} the table holds`,
        )
      }
      bytes[o] = s & 0xff
      bytes[o + 1] = (s >>> 8) & 0xff
      bytes[o + 2] = (s >>> 16) & 0xff
      bytes[o + 3] = sparse[key] ? SPARSE_ROW_ALPHA : 0xff
    }
    const c = color[key]!
    const p = ((y + plane) * width + x) * 4
    bytes[p] = c & 0xff
    bytes[p + 1] = (c >>> 8) & 0xff
    bytes[p + 2] = (c >>> 16) & 0xff
    bytes[p + 3] = c >>> 24
  }
  return {
    keys,
    slot,
    color,
    sparse,
    texture: { bytes, width, height: plane * 2 },
  }
}

/**
 * The keys a display's rows carry across every region: a name's key is
 * assigned the first time it is asked for and never moves, so a region encoded
 * against the registry stays valid as later regions add names and the table
 * alone follows the reader's order, focus and colors. Grows only.
 */
export class RowKeys {
  private readonly index = new Map<string, number>()

  readonly names: string[] = []

  keyOf(name: string): number {
    let key = this.index.get(name)
    if (key === undefined) {
      key = this.names.length
      this.names.push(name)
      this.index.set(name, key)
    }
    return key
  }

  /** The key a name holds, undefined where none was ever assigned. */
  lookup(name: string): number | undefined {
    return this.index.get(name)
  }

  get size() {
    return this.names.length
  }
}
