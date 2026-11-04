---
name: sv-channels-preset-redesign
description: "Track menu → Presets → SV channels now draws the evidence reads: facet svChannel + filter svSignal + pileup shown + arcs, ordinary pairs off, sashimi off (ADR-258 amended 2026-11-04), on top of ADR-259 (category filters leave coverage whole), svChannel keyed off svSignal's chain verdict, and filter lists merging by field (ADR-240 amended). Left: reshoot eight figures, capture the two SV channels loci for Colin and decide heightMode 'grow' from them, and Colin's call on renaming svChannel."
---

# SV channels: from hiding the reads to a filter

## Built (2026-11-04)

- **ADR-259**: `name` and the read categories pick drawn reads and leave
  coverage, junctions and the fade counting every read; `sampleEvents` feeds
  the tooltip and coverage hit test. Bench in
  `plugins/alignments/benches/drawnReadFilter.bench.ts`.
- **ADR-229 and ADR-258 amended**: split evidence needs a junction between two
  placed read-adjacent pieces (`shared/splitReadJunctions.ts`), and the
  `svChannel` facet keys whole chains, `none` exactly when the chain is not SV
  evidence. Pinned in `shared/svChannel.test.ts`.
- **ADR-240 amended**: a plot draft or a settings bag writing a `filter` list
  merges by field (`listMergedBy`, `core/configuration/mergedList.ts`).
- **ADR-258 amended again**: the preset writes `pileup.show: true` and
  `filter: [{ field: 'svSignal', equal: true }]`; a band drawing no reads has
  no collapse chevron. Configurable presets parked there as a Rejected row.

## Next

- **Reshoot** (specs updated, images stale): `sv_channels`,
  `sv_channels_long_reads` (`website/scripts/specs/sv.ts`, hand-set heights
  800 / 190 / 460), `alignments/filter_dialog` (new headings), and
  `cancer_sv`'s `derivative_inserts`, `derivative_synteny`,
  `k562_fusion_inspector_reads`, `k562_bcr_abl_split`, `realigned_reads`.
  Every one needs this branch's app build (worker and UI changes), so
  `generate-screenshots.ts` without `--port`.
- **Captures for Colin** at the 1000 Genomes INVdup locus (`sv_channels`) and
  HG008-T CDKN2A (`sv_channels_long_reads`, 798 Illumina reads in the
  "elsewhere" band at about 1.5% of depth); decide from them whether the
  preset also writes `heightMode: 'grow'` (not a plot key, so through the
  display's setter).
- **Colin's call**: "channel" means an encoding channel elsewhere in the
  grammar (ADR-131, 173, 236), so `svChannel` could become `svKind` while it
  is beta-only (since 2026-11-02); after the tag it costs a `retired` entry.
- The band diagram in `sv_visualization.md` draws coverage and arcs only; it
  could draw the evidence reads in each band.
- Not done: one chain grouping shared between the drawn-read mask and the
  `svChannel` partition (each builds its own name keys; about 15 ms on 81k
  short reads).
