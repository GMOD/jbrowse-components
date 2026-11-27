---
name: small-genome-support
description: "Bacterial, viral and mitochondrial genome follow-ups left after the GenBank reader and open-genome form landed: a feature track from a GenBank in the form, the mark details click's origin lookup, retired GenBank qualifiers."
---

# Small-genome support

What landed is in git (`git log --grep=GenBank --grep=origin --grep=density -i`
around `4d6355a975`). Already filed elsewhere, not repeated here:
`ideas/collections/circular-view-open-items.md` (rings) and the decline sentences
in `packages/core/src/util/originCut.ts` (origin cuts outside GFF3, a wrapping
locstring, a search hit across the origin).

## Open

- **The form opens no feature track from a GenBank, whether it is the genome
  or its annotation.** A lone GenBank becomes the `GenbankSequenceAdapter`
  assembly alone. A GenBank beside a FASTA, .fa.gz or 2bit (Prokka's .fna +
  .gbk) that can open as dropped is read as that genome's annotation
  (`partitionSequences` in `packages/core/src/util/assemblyConfigUtils.ts`):
  the other file is the genome, and `FileNotices` in
  `packages/core/src/ui/AddGenomePane.tsx` says to drop the GenBank on a view
  of it, or use Open track, once one is open. Beside an unindexed .fna.gz
  (NCBI's FTP pair) the GenBank stays the genome. The
  form has no way to return a track with an assembly. The desktop start screen
  builds the new session's config with an empty `tracks` list
  (`products/jbrowse-desktop/src/components/StartScreen/StartScreenDialogs.tsx`),
  so a `GenbankAdapter` track could be added there cheaply; in-session Open
  genome and the web assembly manager form would need to return a companion
  track, a new contract across both callers. `FormState` would carry the
  annotation locations, `buildAssemblyConf` or its callers would turn them into
  track confs on the new assembly name, and the notice would become a line on
  the recognition card. Dropping the file on an open view stages it as that
  track.
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
