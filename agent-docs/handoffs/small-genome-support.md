---
name: small-genome-support
description: "Bacterial, viral and mitochondrial genomes after the GenBank reader, the density-10 default and the origin-export fix landed: the deep amplicon BAM docs and measurement and GenBank in the open-genome form."
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
- **Add GenBank to the web/desktop open-genome form.** One extension maps to two
  adapters (`GenbankSequenceAdapter` for the assembly, `GenbankAdapter` for the
  track), and a test requires the form to offer every sequence format in
  `packages/add-track-core/src/formats.ts`. That means a new form field and
  about 10 call sites in `packages/core/src/util/assemblyConfigUtils.ts`. Config and
  `jbrowse add-assembly` already work.
- **GenBank export writes NCBI GFF3's `gb-synonym` on `source`.** A GFF3
  track's `gbkey=Src` region becomes the record's `source` (`sourceQualifiers`
  in `packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/genbank.ts`);
  `Dbxref`, `substr` and `genome` are respelled or dropped, but a qualifier INSDC
  has no key for, such as `gb-synonym`, is written as is. No qualifier line is
  wrapped at 80 columns; Biopython 1.86 reads the output either way.
- **Feature details opened without `GetBasicFeatureDetails` wraps only by the
  assembly.** The file's own `Is_circular` reaches details as a `circularLength`
  that RPC stamps, so a details widget restored from a session snapshot reads a
  feature past the origin of a FASTA assembly with no `circularRefNames` as
  linear. Listing the sequence in `circularRefNames` covers it.
- **A text-index hit across a circular origin navigates to its first piece
  only.** The GenBank indexer writes `join(92000..92721,1..500)` on a
  `LOCUS circular` record as `NC_002128:92000..93221`, where the adapter draws
  it, but `locStringsToRegions` clamps an end past the contig, so choosing the
  hit shows 92000..92721. NCBI records only; Prokka writes every record linear.
  Read from `packages/text-indexing-core/src/types/genbankAdapter.ts`, not run.

## Open questions, unverified

- **chrM heteroplasmy:** a variant display encoding allele fraction (`AF`/`AD`)
  was not checked; grep `plugins/variants/src` and `cellColorConfigSchema.ts`
  before proposing anything.
