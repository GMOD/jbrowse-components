import { MIN_VISIBLE_ALPHA, insertionSizeAlpha } from '@jbrowse/alignments-core'

// An insertion consumes no reference span, so its marker is a fixed glyph at
// every zoom and nothing about the geometry stops a megabase-wide view from
// painting one per indel. insertion.slang's size gate is what bounds that, and
// these are the cases it exists for. Both backends multiply it into their alpha
// (insertion.slang vs_main, features/insertion/drawCanvas.ts).

// bpPerPx -> pxPerBp, the form both renderers pass.
const pxPerBp = (bpPerPx: number) => 1 / bpPerPx

test('an insertion is fully drawn once its own sequence covers a pixel', () => {
  // base-level zoom: even 1bp is 10px of screen
  expect(insertionSizeAlpha(1, pxPerBp(0.1))).toBe(1)
  // exactly one pixel of inserted sequence is the top of the ramp
  expect(insertionSizeAlpha(10, pxPerBp(10))).toBe(1)
  // and a kilobase-scale insertion survives a megabase-wide frame, which is the
  // half of this that must keep working: a real structural event stays visible
  expect(insertionSizeAlpha(5000, pxPerBp(3700))).toBe(1)
})

test('a sub-pixel insertion fades, and disappears when zoomed out far enough', () => {
  // half a pixel of inserted sequence, half drawn
  expect(insertionSizeAlpha(1, pxPerBp(2))).toBeCloseTo(0.5)

  // The case this gate was written for: a whole-genome chain's few-bp indels
  // over a 5.2 Mb frame. Every one of these used to paint at full opacity,
  // because they clear LONG_INSERTION_MIN_LENGTH and the long branch skipped
  // the fade outright.
  const wholeChromosome = pxPerBp(3700)
  expect(insertionSizeAlpha(10, wholeChromosome)).toBeLessThan(
    MIN_VISIBLE_ALPHA,
  )
  expect(insertionSizeAlpha(1, wholeChromosome)).toBeLessThan(MIN_VISIBLE_ALPHA)
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
  expect(insertionSizeAlpha(10, pxPerBp(3700))).toBeLessThan(MIN_VISIBLE_ALPHA)
})
