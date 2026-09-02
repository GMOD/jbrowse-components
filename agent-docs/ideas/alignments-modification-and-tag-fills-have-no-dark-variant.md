---
name: alignments-modification-and-tag-fills-have-no-dark-variant
description: The alignments modification fills in packages/core/src/ui/palette.ts and the categorical tag palette have no dark-theme variant, so a modifications or tag colour scheme paints light-theme colours on a dark track. Left open by the 2026-09-02 LinearAlignmentsDisplay review as a palette decision, not a display fix.
---

# Modification and tag fills have no dark variant

Left open by the LinearAlignmentsDisplay review that landed on 2026-09-02
(`8e44ed5a78`, `d68391829b`). The review closed every legend gap it found in
the colour modules; this one is a palette decision and was kept separate.

`packages/core/src/ui/palette.ts` defines the modification fills (around the
`modifications` block) once, with no `dark` counterpart, and the categorical
tag palette that `colorTagUtils.ts` hashes values into is likewise a single
lap set relit rather than a per-theme pair. Every other read colour the
display uses resolves through the theme.

What deciding it involves:

- whether the modification colours are a brand (the ML/MM colour conventions
  users recognise from other browsers) that should stay identical in both
  themes and only the read body should change, or a palette to relight;
- the same question for the tag laps, where `colorTagUtils.ts` already
  relights three laps for distinguishability and a dark set would be three
  more;
- the legend swatches follow whichever answer, since they composite the same
  fills.

[give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr.md](give-colorneutralread-a-dark-variant-or-fold-it-into-colorpairlr.md)
is the same question asked of one neutral colour.
