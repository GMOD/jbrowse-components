import { frequencyAlpha } from '../shaders/slang/alignmentsUniforms.js.generated.ts'

// Retirement gate for the hand-written `frequencyAlpha` that lived in
// rendererTypes.ts under a "Same formula as frequencyAlpha() in
// alignmentsUniforms.slang" comment. The generated twin now backs
// `frequencyFade`, which every fading pass (mismatch, clip, insertion, gap
// deletion, softclip bases) routes through (adr-051).

// The retired implementation, verbatim.
function retiredFrequencyAlpha(base: number, frequency: number) {
  return base + frequency * (1 - base)
}

test('matches the hand-written twin it replaced', () => {
  for (let b = 0; b <= 20; b++) {
    for (let f = 0; f <= 20; f++) {
      const base = b / 20
      const freq = f / 20
      expect(frequencyAlpha(base, freq)).toBe(retiredFrequencyAlpha(base, freq))
    }
  }
})

test('the endpoints the fade gate depends on', () => {
  // freq 1 (every read carries this base) is fully opaque whatever the
  // sub-pixel coverage — this is what keeps a fixed difference from fading out
  // when zoomed past 1px/bp.
  expect(frequencyAlpha(0.01, 1)).toBe(1)
  expect(frequencyAlpha(0, 1)).toBe(1)
  // freq 0 collapses to the geometric coverage alone. A pass that feeds 0
  // meaning "opaque" gets nothing drawn instead — the softclip-base bug this
  // formula's shared home exists to prevent.
  expect(frequencyAlpha(0.25, 0)).toBe(0.25)
  expect(frequencyAlpha(0, 0)).toBe(0)
  // Full coverage is opaque regardless of frequency, so the caller's `base < 1`
  // gate and this function agree on the boundary.
  expect(frequencyAlpha(1, 0)).toBe(1)
  expect(frequencyAlpha(1, 0.5)).toBe(1)
})

test('is monotonic in both arguments', () => {
  // Neither more coverage nor higher site frequency may ever make a mark
  // fainter; a sign slip in the lerp would invert one of them.
  for (let i = 0; i < 20; i++) {
    expect(frequencyAlpha(i / 20, 0.5)).toBeLessThanOrEqual(
      frequencyAlpha((i + 1) / 20, 0.5),
    )
    expect(frequencyAlpha(0.5, i / 20)).toBeLessThanOrEqual(
      frequencyAlpha(0.5, (i + 1) / 20),
    )
  }
})
