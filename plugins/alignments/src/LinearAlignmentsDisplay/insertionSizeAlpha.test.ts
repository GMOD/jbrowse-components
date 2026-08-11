import { insertionSizeAlpha } from '@jbrowse/alignments-core'

import { sizeAlpha } from './renderers/rendererTypes.ts'

// The indel size gate (alignmentsUniforms.slang `sizeAlpha`, and its insertion
// flavour in insertion.slang). An indel drawn in bulk has no geometry stopping
// a megabase-wide view from painting one marker per op, and the frequency fade
// cannot bound it, so this is what does. Both backends multiply it in
// (insertion.slang / gap.slang vs the two features/*/drawCanvas.ts).

// bpPerPx -> pxPerBp, the form both renderers pass.
const pxPerBp = (bpPerPx: number) => 1 / bpPerPx

test('an indel is fully drawn once its own span covers a pixel', () => {
  expect(sizeAlpha(1)).toBe(1)
  expect(sizeAlpha(40)).toBe(1)
  // base-level zoom: even 1bp of inserted sequence is 10px of screen
  expect(insertionSizeAlpha(1, pxPerBp(0.1))).toBe(1)
  // a kilobase-scale insertion survives a megabase-wide frame, which is the
  // half of this that must keep working: a real structural event stays visible
  expect(insertionSizeAlpha(5000, pxPerBp(3700))).toBe(1)
})

test('a sub-pixel indel fades, and snaps to zero once invisible', () => {
  // half a pixel of span, half drawn
  expect(sizeAlpha(0.5)).toBeCloseTo(0.5)
  expect(insertionSizeAlpha(1, pxPerBp(2))).toBeCloseTo(0.5)

  // Below one 8-bit alpha step it snaps to exactly 0, which is the value both
  // backends test to skip the instance outright rather than rasterize nothing.
  expect(sizeAlpha(0.001)).toBe(0)

  // The case this gate was written for: a whole-genome chain's few-bp indels
  // over a 5.2 Mb frame. Every one of these used to paint at full opacity --
  // insertions because they clear LONG_INSERTION_MIN_LENGTH and skipped the
  // fade outright, deletions because the frequency lerp returns 1 for a site
  // every read carries.
  const wholeChromosome = pxPerBp(3700)
  expect(insertionSizeAlpha(10, wholeChromosome)).toBe(0)
  expect(insertionSizeAlpha(1, wholeChromosome)).toBe(0)
})

test('the gate is monotonic in both length and zoom', () => {
  const at = (len: number, bpPerPx: number) =>
    insertionSizeAlpha(len, pxPerBp(bpPerPx))

  // a longer insertion is never less visible than a shorter one
  expect(at(100, 50)).toBeGreaterThan(at(10, 50))
  // and zooming in never makes one less visible
  expect(at(10, 5)).toBeGreaterThan(at(10, 50))
})

test('frequency cannot substitute for it, which is why they multiply', () => {
  // frequencyAlpha is `base + freq*(1 - base)`, so a site carried by every read
  // at that depth returns 1 however sub-pixel `base` is. A synteny alignment
  // has depth 1, so every indel it carries has frequency 1 -- the exact case
  // the frequency gate is blind to, and the reason this one is separate.
  const freqAlpha = (base: number, freq: number) => base + freq * (1 - base)
  expect(freqAlpha(1e-8, 1)).toBe(1)
  expect(insertionSizeAlpha(10, pxPerBp(3700))).toBe(0)
})
