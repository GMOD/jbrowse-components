---
name: dark-theme-palette-gaps
description: Two colour sets in packages/core/src/ui/palette.ts resolve to one light value in both themes — the modification fills and the categorical tag laps — so a dark track paints light-theme colour under the modifications and tag schemes. Each is a palette decision rather than a defect, and the same decision twice.
---

# The palette's dark-theme gaps

Every read colour the alignments display uses resolves through the theme except
two sets, both defined once in `packages/core/src/ui/palette.ts` with no `dark`
counterpart. They are one question asked twice — relight the set, or
declare it a brand that stays put and let the surface around it move — so the
answer should be taken once rather than per set.

## The modification fills and the categorical tag laps

Left open by the LinearAlignmentsDisplay review that landed on 2026-09-02
(`8e44ed5a78`, `d68391829b`). The review closed every legend gap it found in
the colour modules; this one it kept separate as a palette call.

The modification fills sit in the `modifications` block with no `dark`
counterpart, and the categorical tag palette that `colorTagUtils.ts` hashes
values into is likewise a single lap set relit rather than a per-theme pair. So
a modifications or tag colour scheme paints light-theme colour on a dark track.

What deciding it involves:

- whether the modification colours are a brand — the ML/MM colour conventions
  users recognise from other browsers — that should stay identical in both
  themes with only the read body changing, or a palette to relight;
- the same question for the tag laps, where `colorTagUtils.ts` already relights
  three laps for distinguishability and a dark set would be three more;
- the legend swatches follow whichever answer, since they composite the same
  fills.
