---
name: small-genome-support
description: "Bacterial, viral and mitochondrial genomes after the GenBank reader, the open-genome form and the export fixes landed: the deep amplicon BAM measurement, a feature track beside a GenBank genome, and a ruling on a search hit that crosses a circular origin."
---

# Small-genome support

What landed is in git (`git log --grep=GenBank --grep=origin --grep=density -i`
around `4d6355a975`). Already filed elsewhere, not repeated here:
`ideas/collections/circular-view-open-items.md` (rings) and the decline sentences
in `packages/core/src/util/originCut.ts` (origin cuts outside GFF3, a wrapping
locstring).

## Next

- **Deep viral amplicon BAMs: measure, then document.** With a BAI, a
  1,000–100,000× BAM over 30 kb stays bannered at every zoom: the index estimate
  stops shrinking at one 16 kb bin, so the 20 kb sub-floor doubling never clears
  it (`reference/REGION_TOO_LARGE.md` § "The sub-floor budget tier").
  Downsampling cannot lift the banner, since the gate refuses on the index
  estimate before any read is decoded. Coverage-only stays parked
  (`ideas/collections/alignments.md`, read downsampling).
  - **Measure first:** force-load a 5,000× and a 50,000× SARS-CoV-2 BAM and
    record worker heap, time to first paint and whether the worker survives.
    Also check whether a CRAM of the same reads clears the gate by zooming.
  - **Then write a short passage** in `website/docs/tutorials/genomes_basics.md`
    and the BAM/CRAM adapter config docs, stating the depth the measurement
    supports:
    - a mosdepth or bamCoverage bigWig for the whole-genome picture;
    - `fetchSizeLimit` raised on the viral track only, which is safe because a
      30 kb assembly cannot spill onto a human chromosome;
    - CRAM preferred.
- **A GenBank genome opened through the form gets no feature track.** The
  form writes the `GenbankSequenceAdapter` assembly alone, since it has no way
  to return a track with an assembly. The desktop start screen builds the new
  session's config with an empty `tracks` list
  (`products/jbrowse-desktop/src/components/StartScreen/StartScreenDialogs.tsx`),
  so the `GenbankAdapter` track could be added there cheaply; in-session Open
  genome and the web assembly manager form would need to return a companion
  track, a new contract across both callers. Dropping the file on an open view
  stages it as that track.
- **A text-index hit across a circular origin navigates to its first piece
  only; needs a ruling.** Reproduced: `ctgB` 5999..6500 shows as
  `ctgB:6,000..6,079`. The clamp is in `navToLocations`
  (`plugins/linear-genome-view/src/LinearGenomeView/model.ts`), reached through
  `navToOption` and `parseLocStrings`, not in `locStringsToRegions`. The GFF3
  indexer (`packages/text-indexing-core/src/types/gff3Adapter.ts`) writes an
  over-length end too. Two routes:
  - navigation splits an over-length end on a circular contig in two, which is
    the wrapping locstring `originCut.ts` declines (2026-10-14);
  - the indexer writes both pieces (`NC_002128:92000..92721 NC_002128:1..500`,
    which `navToLocations` accepts), but `landsInAssembly` in
    `packages/core/src/TextSearch/places.ts` parses one locstring and drops the
    hit from the dropdown, so it also touches `groupByPlace`'s `spanOf`,
    `highlightSearchResultFeature`, `RefNameAutocomplete/util.ts` and
    `products/jbrowse-img/src/renderRegion.ts`.
- **A mark details click costs one more adapter read**, the origin lookup in
  `executeGetEncodedFeature`, on every sequence, since nothing on a row says
  its sequence is circular; a row a step computed fields on loses them when the
  whole record replaces it. Read, not run.
- **GenBank export respells into qualifiers INSDC has retired for new
  entries** (`clone_lib`, `pop_variant`, `sub_strain`), which older records
  still carry and a new-submission validator flags. With both `gb-synonym` and
  `gb-acronym` on a source the second becomes a `/note`, and the reader ignores
  SOURCE, so a synonym does not survive a re-import.

## Open questions, unverified

- **chrM heteroplasmy:** a variant display encoding allele fraction (`AF`/`AD`)
  was not checked; grep `plugins/variants/src` and `cellColorConfigSchema.ts`
  before proposing anything.
