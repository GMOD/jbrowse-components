import {
  frequencyAlpha,
  frequencyFadeGate,
} from '../shaders/slang/alignmentsUniforms.js.generated.ts'
import { intronAlpha } from '../shaders/slang/gap.js.generated.ts'

// Retirement gates for the alpha math rendererTypes.ts used to spell out itself
// (adr-051).
//
// `frequencyAlpha` sat under a "Same formula as frequencyAlpha() in
// alignmentsUniforms.slang" comment; the generated twin now backs
// `frequencyFade`, which every fading pass (mismatch, clip, insertion, gap
// deletion, softclip bases) routes through. `frequencyFadeGate` is the decision
// *around* that lerp, which stayed hand-written on both sides a while longer —
// and is where the interesting bugs were, since dropping one of its three facts
// still produces a plausible number.
//
// `intronAlpha` is the sharper case: the shader called `smoothstep(1, 4, h)`
// and the TS hand-expanded the polynomial, with a comment on *each* side asking
// whoever edited it to go change the other. That is a note, not a mechanism.

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

// The retired gate, verbatim. The lerp above was generated; the three-fact
// decision around it — read the toggle, test for sub-pixel, short-circuit to
// fully opaque — stayed hand-written on both sides.
function retiredFrequencyFade(
  base: number,
  freq: number,
  filterByFrequency: boolean,
) {
  return filterByFrequency && base < 1 ? frequencyAlpha(base, freq) : 1
}

test('the fade gate matches the hand-written twin it replaced', () => {
  for (const filter of [true, false]) {
    for (let b = 0; b <= 20; b++) {
      for (let f = 0; f <= 20; f++) {
        const base = b / 20
        const freq = f / 20
        expect(frequencyFadeGate(base, freq, filter)).toBe(
          retiredFrequencyFade(base, freq, filter),
        )
      }
    }
  }
})

test('the fade gate is off unless the toggle is on', () => {
  // Losing this branch is the clip-pass bug: every low-frequency mark faded
  // whether or not the user asked for it.
  expect(frequencyFadeGate(0.1, 0, false)).toBe(1)
  expect(frequencyFadeGate(0.1, 0, true)).toBe(0.1)
  // A feature already covering a full pixel is opaque either way — the boundary
  // is exclusive, so base exactly 1 takes the ungated path.
  expect(frequencyFadeGate(1, 0, true)).toBe(1)
})

// The retired intron fade, verbatim: the smoothstep expanded by hand, with the
// bounds and floor as local consts.
function retiredIntronAlpha(featureHeight: number) {
  const t = Math.min(1, Math.max(0, (featureHeight - 1) / (4 - 1)))
  return 0.25 + 0.75 * (t * t * (3 - 2 * t))
}

test('intronAlpha matches the hand-expanded smoothstep it replaced', () => {
  // Quarter-pixel steps across every read height the fit ladder can produce,
  // including both ends of the ramp and well past it.
  for (let i = 0; i <= 80; i++) {
    const h = i * 0.25
    expect(intronAlpha(h)).toBeCloseTo(retiredIntronAlpha(h), 9)
  }
})

test('introns fade only at the compact end', () => {
  // Full opacity at and above the 4px knee — the default 7px read must not be
  // faded at all, or every splice line in a normal pileup dims.
  expect(intronAlpha(4)).toBe(1)
  expect(intronAlpha(7)).toBe(1)
  expect(intronAlpha(20)).toBe(1)
  // Floored at the bottom: a 1px read's introns are faint, never invisible.
  expect(intronAlpha(1)).toBeCloseTo(0.25, 9)
  expect(intronAlpha(0)).toBeCloseTo(0.25, 9)
  // Monotonic through the ramp, so shrinking rows never brighten.
  for (let i = 0; i < 20; i++) {
    expect(intronAlpha(i / 4)).toBeLessThanOrEqual(intronAlpha((i + 1) / 4))
  }
})
