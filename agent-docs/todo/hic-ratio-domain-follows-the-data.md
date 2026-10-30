---
name: hic-ratio-domain-follows-the-data
description: The Hi-C display's two ratio fields, observed/expected and observed/control, pin their color domain at a quarter to fourfold through their preset, and no written value returns an end to following the loaded ratios. The spelling of that domain is config vocabulary the 5.0.0 tag freezes.
metadata:
  area: config
  category: ready
  order: 1
  first_move: "pick how a ratio field asks to follow the data in the landed flat `scale.domainMin`/`domainMax`/`domainQuantile` spelling: ADR-238 has a `null` domain end autoscale, but a `null` write resets to the default, which for a ratio is the preset's 4"
---

# A Hi-C ratio's color domain can follow the data again

`HIC_FIELD_PRESETS` (`plugins/hic/src/LinearHicDisplay/hicColorConfigSchema.ts`)
gives both ratio fields `domainMin: 0.25`, `domainMax: 4` and `domainMid: 1`, so
two tracks, and two conditions, read one color for one ratio. That default was
settled on 2026-10-22 over a per-track quantile, which recentres on each
track's own noise and fakes a difference between conditions.

What it leaves out is the way back. A written end replaces the preset's, but
`maybeNumber` takes no `null`, and an unset end falls back to the preset, so no
config makes a ratio's top follow the loaded values as `observed`'s does.

- The landed channel spells the domain flat
  (`encoding.color.scale.domainMin`, `domainMax`, `domainQuantile`;
  `packages/core/src/util/colorScale.ts`); ADR-238's
  `domain: [0.25, { quantile: 0.95 }]` form never landed. Whichever spelling asks a ratio to
  follow the data, its quantile is of `max(r, 1/r)`, mirrored so 1 stays at
  the middle. The worker already scores a quantile; on a ratio it needs to
  score the folded value instead.
- The log scale floors at a pinned `domainMin`, else at 1 (`scoreScale.slang`),
  so a ratio domain anchored at 0 paints 0.5 and 0.01 alike. A symmetric
  domain never anchors there.
- Spell it as every other channel does, so the field never has two
  spellings.
