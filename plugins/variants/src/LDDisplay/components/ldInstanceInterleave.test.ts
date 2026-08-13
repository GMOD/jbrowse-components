// The genomic LD pass packs one instance per cell, and nothing tested it — the
// interleave was a hand-written field-for-field transcription of the generated
// `packInstances`, and swapping to the generated one was therefore a change no
// suite in this plugin could have caught.
//
// This is the retirement gate for that swap (adr-051 step 5, applied to a packer
// rather than a twin): the expected bytes are spelled out from the shader's own
// offsets, so the test states the layout independently of the packer that
// produces it. A field reordered in `ldGenomic.slang` moves both sides and stays
// green — which is correct, that is the layout being the shader's — but a packer
// that fed the wrong array into a lane does not.
import { interleaveLDInstances } from './GpuLDRenderer.ts'
import {
  INSTANCE_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/ldGenomic.iface.generated.ts'

// Distinct magnitudes per lane, so a transposed pair is a visibly wrong number
// rather than a plausible one.
const data = {
  positions: Float32Array.from([10, 20, 30, 40, 50, 60]),
  cellSizes: Float32Array.from([1, 2, 3, 4, 5, 6]),
  ldValues: Float32Array.from([0.25, 0.5, 0.75]),
  numCells: 3,
}

describe('LD genomic instance interleave', () => {
  test('packs exactly numCells instances', () => {
    expect(interleaveLDInstances(data).byteLength).toBe(
      3 * INSTANCE_STRIDE_BYTES,
    )
  })

  test('each cell carries its own position pair, size pair and value', () => {
    const f32 = new Float32Array(interleaveLDInstances(data))
    for (let i = 0; i < data.numCells; i++) {
      const o = i * INSTANCE_STRIDE_WORDS
      // A vecN field reads N consecutive values per instance, which is the
      // shape `positions` and `cellSizes` already have — the property that let
      // the generated packer replace the loop.
      expect(f32[o + INSTANCE_OFFSET_F32.position]).toBe(data.positions[i * 2])
      expect(f32[o + INSTANCE_OFFSET_F32.position + 1]).toBe(
        data.positions[i * 2 + 1],
      )
      expect(f32[o + INSTANCE_OFFSET_F32.cellSize]).toBe(data.cellSizes[i * 2])
      expect(f32[o + INSTANCE_OFFSET_F32.cellSize + 1]).toBe(
        data.cellSizes[i * 2 + 1],
      )
      expect(f32[o + INSTANCE_OFFSET_F32.ldValue]).toBe(data.ldValues[i])
    }
  })

  // The three lanes must land at three different offsets; an emitter that
  // collapsed them would keep every assertion above true by writing each value
  // over the last.
  test('the three fields occupy distinct words', () => {
    const { position, cellSize, ldValue } = INSTANCE_OFFSET_F32
    expect(new Set([position, cellSize, ldValue]).size).toBe(3)
  })

  test('an empty matrix packs nothing', () => {
    expect(
      interleaveLDInstances({
        positions: new Float32Array(0),
        cellSizes: new Float32Array(0),
        ldValues: new Float32Array(0),
        numCells: 0,
      }).byteLength,
    ).toBe(0)
  })
})
