---
name: sbx-duplex-yc-coloring
description: Roche SBX duplex reads carry a YC tag recording, per base, whether the two strands agreed, disagreed (and what each read) or only one covered. Released BAMs keep it, and their binned QUAL already shows the three classes under base-quality coloring, so the gap is the R1/R2 pair, decoded in the feature detail panel and as labeled mismatch-style marks.
---

# SBX duplex reads: `YC`-tag coloring

Split out of the alignments collection on 2026-09-27; checked against the XOOS
spec and source on 2026-11-01.

Roche's sequencing-by-expansion (SBX, AXELIOS platform; XOOS analysis tools)
emits **duplex consensus reads** (SBX-D): one read per molecule, built by
aligning the forward strand (R1) to the reverse complement read through the
hairpin (R2). Each consensus base is one of:

- **duplex-concordant**: R1 and R2 agree.
- **duplex-discordant**: a mismatch or indel between R1 and R2. The consensus
  takes R1's call (stated for the read collapser's singleton case; demux only
  says "resolved").
- **simplex tail**: only one strand reaches this end of the insert.

What the `YC` tag adds over a quality bin is **what each strand read** at a
discordant position. That is the duplex-sequencing question a variant reviewer
asks: an alt base on both strands is a mutation, one on a single strand with a
damage signature (C/T deamination, G/T 8-oxoG) is an artifact.

## The tag

Spec: XOOS `docs/interpreting-sbx-d-reads.md`. Reference decoder:
`common/yc_decode/src/xoos/yc-decode/yc-decoder.{h,cpp}`.

- **Uppercase `YC`**, a string aux tag. Simplex reads carry none; an empty tag
  also means simplex.
- `{left_tail}{delim}{duplex}{delim}{right_tail}`, always two delimiters. `+`
  means R1 supplied that end's tail (also the default when there is no tail),
  `-` means R2. Tails are bare counts.
- In the duplex segment a number is a run of concordant bases and a letter is
  one discordant position. **Uppercase consumes one consensus base, lowercase
  is a consensus gap** (R1 or R2 had a base the consensus dropped). Both cases
  index the same 26-entry pair table (`N` and `U` unused):

  ```
  kDecodingR1 = "ACCGTTGTAGG-A--C-ACT-GATC-"
  kDecodingR2 = "AACACGGA--TAC-G-CGGT-CT-TT"
  ```

  So `Z` is R1 `-` / R2 `T` with a `T` in the consensus, and `X` is R1 `T` /
  R2 `-`. Reverse complement maps codes through `kComplement` /
  `kGapComplement`, not by complementing the decoded pair.
- **Read orientation, not reference orientation.** A reverse-strand record's
  tag must be reverse-complemented, and soft clips trimmed off it, before it
  maps onto the reference. The XOOS decoder's `ReverseComplement()` and
  `Trim()` exist for this; `read_collapser/src/io/alignment.cpp` shows the call
  order.

## Does it survive alignment

Roche's released GIAB BAMs carry it: their error-rate tutorial
(`docs/measuring-error-rate-for-sbx-duplex-data.md`) pulls it out of the
Giraffe-aligned HG001 BAM with `samtools bam2fq -T YC` and keeps it through
`bwa mem -C`, and the read collapser and small variant caller (`YcDecodeMethod`
`consensus` / `split`) both read it off aligned records. Third-party pipelines
that skip `-T YC` / `-C` drop it.

Confirmed on the released Giraffe-aligned, non-downsampled HG002 SBX-D BAM
(`@PG` chain: vg, samtools sort, `read_collapser markdup --preset wgs-duplex`,
`read_collapser_rescue_secondary`): the first 1M records all carry a non-empty
`YC`, and for all of the first 20k, tails + runs + uppercase codes equals
`SEQ` length. No lowercase codes and no `-` (R2) tails appeared in 1M
records. Other tags: `AS`, `RG`, `DI:Z` / `DS:i` (markdup cluster id and
size), rarely `YF:i`.

## QUAL already shows the three classes, unlabeled

Demux writes the classes into QUAL as fixed values (concordant Q39 `H`,
discordant Q5 `&`, simplex tail Q22 `7`), and the released BAM still has only
those three values: `markdup` does not recalibrate. QUAL is a pure function of
`YC` there (all 20k records match, reversing the class string for flag 16). So
**Color by → Base quality** (`features/perBaseQuality`) already draws the
duplex layout on Roche's own data. A calibrated QUAL (Q5–Q50) is a separate
read collapser mode; that output would lose the bins.

## Proposed, ranked

- **A `YC` decoder and its decode in the feature detail panel**
  (`AlignmentsFeatureDetail/tagInfo.ts`). Today `YC` is a raw string; render
  the tail lengths and owning strand, the concordant count, and each
  discordant position as its R1/R2 pair. The pair is the only thing `YC`
  carries that QUAL does not.
- **Discordant positions as mismatch-style marks**, labeled by the R1/R2
  pair, so a reviewer sees at a glance whether an alt base is on both strands
  or one. Shares the decoder.
- **(Only for calibrated-QUAL data) an "SBX duplex" per-base color scheme.**
  Base-quality coloring already shows the classes on binned data, so this
  earns its shader path only once calibrated-QUAL BAMs are in circulation.
  `features/perBaseQuality` and `features/perBaseLetter` are the template: an
  `extract.ts` reading the tag (`getTagAlt(feature, 'YC')`, the MM/ML idiom),
  orienting it to the record, and walking `forEachAlignedBaseInRegion`
  (`features/alignedBaseWalk.ts`) to emit per-ref-base classes. Register in
  `COLOR_FIELD_DEFS` (`shared/colorFieldDefs.ts`) and the `ColorFieldKind`
  union (`shared/types.ts`), which fails to compile until it has a shader
  path and menu placement.

Not in scope: drawing R1 and R2 as two reads (the variant caller's `split`
mode). Pairs with the concordant/discordant partition in
[ready/coverage-summarization-by-read-attribute.md](coverage-summarization-by-read-attribute.md).

Example data: Roche's GIAB SBX-D BAMs (HG001/HG002) from
`sequencing.roche.com/SBXdata` (download portal
`web.sbxdata.kamino.platform.navify.com`, behind a form). The XOOS repo
(`github.com/Roche-AXELIOS/XOOS`) ships no small BAM fixtures, so a
region-sliced GIAB BAM is the path to a test fixture; the spec's worked
examples (`4+13-3`, `+1WK1I1L+`, `+1KM3L+2`, `9++`) are the decoder's unit
cases.
