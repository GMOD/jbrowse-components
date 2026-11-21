---
name: the-lane-words-fold-into-one-layer-list
description: After v5, fold MultiWaySyntenyDisplay's `laneGeneTracks` into the first entry of `laneLayers` at ADR-180's stage 2, and pick the folded slot's one word or nested name then. Read before respelling either lane word or starting stage 2.
---

# The lane words fold into one layer list

Both words ship in v5 as they are (2026-11-20 spellings review): the fold is
engineering, not a respelling, and a respell before it would lift jb2hubs'
hosted star tracks (`hubtools/src/multiwayStarTrack.ts`,
`website/src/components/geneOrderStar.ts`) twice.

## What waits

- [ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)'s
  stage 2 moves the gene glyphs and placement boxes onto `encodeFeatures`,
  gated on measuring the encoder at 40 lanes. Until then a gene layer has no
  annotation fallback, gene adapter or label row, so `laneGeneTracks` cannot
  be a `laneLayers` entry without being a second spelling of it.
- At the fold, `laneGeneTracks` lifts through the display's `retired` table
  into the first layer, and the folded slot takes its name. Both words are
  camelCase today; a one-word or nested name is chosen with the fold, not
  before it. `layers` alone was declined (ADR-180, 2026-11-17), since an
  entry's `marks` are what superimpose; `rows` is already the lanes.

## The call

Whether stage 2 lands, and with it the name, is Colin's.
