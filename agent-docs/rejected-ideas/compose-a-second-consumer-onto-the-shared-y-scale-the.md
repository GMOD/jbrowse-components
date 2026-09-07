---
name: compose-a-second-consumer-onto-the-shared-y-scale-the
description: Compose a second consumer onto the shared y scale, the way density composed the colour ramp
area: rendering-and-displays
---

# Compose a second consumer onto the shared y scale, the way density composed the colour ramp

censused and declined 2026-08-29. The census is
[ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md);
the scale half of the y channel already factored under
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
and every remaining candidate trips a kill condition. Four were measured.
*Manhattan onto `scoreScale`*: `scoreToYPx(0.5, 0, 0, 100)` is 0 and
`normalizeScore`'s answer places the same score at 100, so a score above a
pinned degenerate domain moves by the full canvas height — a value
`scoreToYParity.test.ts` pins as a deliberate Canvas2D fix — and Manhattan's
`scaleType: 'linear'` is fixed in three places, so the composed uniforms would
have exactly one caller (ADR-040). *The coverage tick anchor onto wiggle's
`scoreToAxisY`*: identical above `covHeight = 10` and divergent below, where at
`covHeight = 8` the coverage anchor answers 3 for every normalized value and
the wiggle anchor answers 5 — the short-band case `covEffectiveHeightPx`'s
floor exists for. *The arc band's `arcYFraction` with hic's `mapHicCount`*:
the log branches are the same expression, the linear branches and the clamp
placement are not, and factoring the shared line leaves both wrappers, both
`//! js-export`s and both parity suites — one line deleted, no twin.
*Deleting `coverageBand.slang`'s `normalizeDepthScalar`*: its shader body is
already a one-line delegation, and its only non-generated caller is the
alignments coverage parity sweep it exists to be the oracle for. Reopen if a
new display arrives whose y anchor is genuinely one of the existing ones — a
second display banding a scalar against a baseline with reserved insets at both
ends is the shape to watch for, since that would give the coverage anchor its
second consumer.
