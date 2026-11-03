---
name: dark-theme-palette-gaps
description: Several data color sets resolve to one light value in both themes — the alignments modification fills and tag laps, the variant matrix's reference and unphased cells, the wiggle heatmap's white midpoint, synteny's CIGAR colors — so a dark track paints light-theme color under them. Each is a palette decision rather than a defect, and the same decision asked per set.
---

# The palette's dark-theme gaps

Every read color the alignments display uses resolves through the theme except
two sets, both defined once in `packages/core/src/ui/palette.ts` with no `dark`
counterpart. They are one question asked twice — relight the set, or
declare it a brand that stays put and let the surface around it move — so the
answer should be taken once rather than per set.

## The modification fills and the categorical tag laps

Left open by the LinearAlignmentsDisplay review that landed on 2026-09-02
(`8e44ed5a78`, `d68391829b`). The review closed every legend gap it found in
the color modules; this one it kept separate as a palette call.

The modification fills sit in the `modifications` block with no `dark`
counterpart, and the categorical tag palette that `colorTagUtils.ts` hashes
values into is likewise a single lap set relit rather than a per-theme pair. So
a modifications or tag color scheme paints light-theme color on a dark track.

What deciding it involves:

- whether the modification colors are a brand — the ML/MM color conventions
  users recognise from other browsers — that should stay identical in both
  themes with only the read body changing, or a palette to relight;
- the same question for the tag laps, where `colorTagUtils.ts` already relights
  three laps for distinguishability and a dark set would be three more;
- the legend swatches follow whichever answer, since they composite the same
  fills.

## The same question outside alignments

Each of these is a fixed light value with no palette home, so one answer
above should reach them too:

- the variant matrix: `REFERENCE_COLOR` `#ccc` and `UNPHASED_COLOR` black
  (`plugins/variants/src/shared/constants.ts`), bright and invisible cells on a
  dark ground;
- the wiggle heatmap's `WIGGLE_RECT_MIDDLE` `#ffffff`, the color the density
  ramp fades from at the origin (`plugins/wiggle/src/shared/wiggleColor.ts`);
- synteny's `defaultCigarColors` (`packages/synteny-core/src/colorUtils.ts`),
  which already names a dark variant as its follow-up. The synteny band itself
  stays light by design (`bandGround.ts`), so this one only matters if that
  does.
