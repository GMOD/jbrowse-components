---
name: hic-ratio-domain-follows-the-data
description: The Hi-C display's two ratio fields, observed/expected and observed/control, pin their color domain at a quarter to fourfold through their preset, and no written value returns an end to following the loaded ratios. The spelling of that domain is config vocabulary the 5.0.0 tag freezes.
metadata:
  area: config
  category: ready
  order: 1
  first_move: "with the channel object (ADR-238's Channel section), spell a ratio field's domain `[min, { quantile }]`, the quantile symmetric in log space"
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

- ADR-238's channel object answers it: `domain: [0.25, { quantile: 0.95 }]` on a
  ratio is the quantile of `max(r, 1/r)`, mirrored so 1 stays at the middle.
  The worker already scores a quantile; on a ratio it needs to score the folded
  value instead.
- The log scale floors at a pinned `domainMin`, else at 1 (`scoreScale.slang`),
  so a ratio domain anchored at 0 paints 0.5 and 0.01 alike. A symmetric
  domain never anchors there.
- Land it with the app-wide channel-object pass rather than as a Hi-C-only
  slot, so the field never has two spellings.
