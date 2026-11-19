---
name: small-genome-support
description: "Bacterial, viral and mitochondrial genomes after the GenBank reader, the density-10 default and the origin-export fix landed: the deep amplicon BAM docs and measurement, GenBank in the open-genome form, and a linear feature past its sequence's end."
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
- **A feature on a linear sequence ending past its end wraps in feature details.**
  `originCrossingLength`
  (`packages/core/src/BaseFeatureWidget/SequenceFeatureDetails/util.ts`) tests
  only `end > length`, so the sequence panel and `featureNavigator.ts` treat any
  such feature as crossing an origin. Export now gates on the file's
  `Is_circular` line (`declaredCircularLengths` in `fetchTrackData.ts`), but
  details has no declaration in hand. A candidate gate is
  `assembly.isCircularRefName`, which now also reads a GenBank `LOCUS circular`.
  Repro: the `pLinear` fixture in `plugins/gff3/src/originSpanning.test.ts`.
- **Name `circularRefNames` for FASTA + GFF3 users.** The slot is documented
  only in the generated config pages and `tutorials/organelle_map.md`. A
  FASTA + GFF3 bacterium needs the slot by hand (the NCBI sequence report has no
  topology column), so one sentence belongs in `config_guides/assemblies.md`.
- **Check that the generated GenBank pages appear.**
  `website/docs/config/Genbank*.md` and the FILE_TYPES rows were not written:
  pre-push autogen stopped on two unrelated docs gates (the hand-written fence
  baseline, and an ideas description over 45 words). They regenerate on the
  first push whose autogen passes.

## Open questions, unverified

- **chrM heteroplasmy:** a variant display encoding allele fraction (`AF`/`AD`)
  was not checked; grep `plugins/variants/src` and `cellColorConfigSchema.ts`
  before proposing anything.
- **Prokka's run-together `LOCUS` line** (`NODE_1_length_52345_cov_23.45152345 bp`)
  is not parsed; the name becomes the refName in both GenBank adapters. Only a
  circular record would miss its origin cut.
