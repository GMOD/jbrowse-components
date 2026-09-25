import * as shader from '../../shaders/slang/linkedReadLine.generated.ts'
import { LINKED_READ_LINE_MARK } from './mark.ts'

import type { LinkedReadLinesUploadData } from './types.ts'

/**
 * The lanes of `packLinkedReadLines`, against the offsets the vertex stage
 * reads them at.
 *
 * This pass is the one connector packer written by hand rather than emitted —
 * the mark overrides `slangPass`'s `pack`, because an instance carries two rows
 * — so the generated `INSTANCE_OFFSET_*` tables are a contract it can drift
 * from silently. A lane written into the wrong TYPED ARRAY is the way it goes:
 * the word index is the same, so nothing is out of bounds and every line still
 * draws, in whatever colour the float bits of an index decode to.
 */

const DATA: LinkedReadLinesUploadData = {
  linkedReadLinePositions: new Uint32Array([1000, 4096 + 7, 90, 250]),
  linkedReadLineYs: new Uint16Array([3, 11, 0, 400]),
  // Two slots that differ in their float and integer encodings, which is what
  // makes reading them back a check rather than a restatement.
  linkedReadLineColorTypes: new Uint8Array([3, 7]),
  numLinkedReadLines: 2,
}

function packed() {
  const buf = LINKED_READ_LINE_MARK.pass.pack(DATA) as ArrayBuffer
  return { u32: new Uint32Array(buf), f32: new Float32Array(buf) }
}

test('every lane lands at its generated offset, in its generated type', () => {
  const { u32, f32 } = packed()
  const s = shader.INSTANCE_STRIDE_WORDS
  const U = shader.INSTANCE_OFFSET_U32
  const F = shader.INSTANCE_OFFSET_F32
  for (const i of [0, 1]) {
    const o = i * s
    expect({
      bp1: u32[o + U.bp1],
      bp2: u32[o + U.bp2],
      y1: f32[o + F.y1],
      y2: f32[o + F.y2],
      colorType: u32[o + U.colorType],
    }).toEqual({
      bp1: DATA.linkedReadLinePositions[i * 2],
      bp2: DATA.linkedReadLinePositions[i * 2 + 1],
      y1: DATA.linkedReadLineYs[i * 2],
      y2: DATA.linkedReadLineYs[i * 2 + 1],
      colorType: DATA.linkedReadLineColorTypes[i],
    })
  }
})

test('the buffer is exactly the instances, at the generated stride', () => {
  const buf = LINKED_READ_LINE_MARK.pass.pack(DATA) as ArrayBuffer
  expect(buf.byteLength).toBe(
    DATA.numLinkedReadLines * shader.INSTANCE_STRIDE_BYTES,
  )
})

test('a float write of that index would not read back as the index', () => {
  // Why reading `colorType` through the u32 view above is a check rather than a
  // restatement: both encodings occupy the same word, so writing it as a float
  // stays in bounds, keeps the stride, and decodes to a palette slot nobody
  // chose — the clamped last one, for every connector on screen.
  const word = new ArrayBuffer(4)
  new Float32Array(word)[0] = 3
  expect(new Uint32Array(word)[0]).not.toBe(3)
})
