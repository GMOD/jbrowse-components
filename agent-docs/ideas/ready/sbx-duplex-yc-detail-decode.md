---
name: sbx-duplex-yc-detail-decode
description: Roche SBX duplex reads carry a YC tag recording, per base, whether the two strands agreed, disagreed (and what each read) or only one covered. The default quality fade already draws the three classes; what is left is decoding YC in the feature detail panel, so a click shows what each strand read.
---

# SBX duplex reads: decode `YC` in the feature detail panel

Split out of the alignments collection on 2026-09-27; checked against the XOOS
spec and source, and Roche's released HG002 BAM, on 2026-11-03.

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

## QUAL already shows the three classes

Demux writes the classes into QUAL as fixed values (concordant Q39 `H`,
discordant Q5 `&`, simplex tail Q22 `7`), and the released BAM still has only
those three values: `markdup` does not recalibrate. QUAL is a pure function of
`YC` there (all 20k records match, reversing the class string for flag 16), so
the default mismatch fade (Q5 to Q20) draws a both-strand alt opaque and a
discordant one at the 0.1 floor, and **Color by → Base quality** paints all
three classes. A calibrated QUAL (Q5–Q50) is a separate read collapser mode;
that output would lose the bins.

## Proposed

**A `YC` decoder and its decode in the feature detail panel**
(`AlignmentsFeatureDetail/tagInfo.ts`). Today `YC` is a raw string; render
the tail lengths and owning strand, the concordant count, and each discordant
position as its R1/R2 pair. The pair is the only thing `YC` carries that QUAL
does not. Main thread only: no arrays, no renderer.

## Declined

Mocked on 14 HG002 reads at MTHFR C677T and put to a cold review. In a 30 kb
slice, 6,335 of 11,247 single-strand alt calls draw nothing (R1 read the
reference), but at most 6 sit at any one position and base, so they are
artifacts, not hidden variants.

- **Split-strand pileup** (each read drawn as two half-height strands): R1 and
  R2 were never aligned on their own, so the halves are placed by inference;
  every read gains a seam and blank tails that read as deletions. Roche's
  caller in `split` mode writes the strands as reads, which JBrowse draws.
- **Discordant positions as mismatch-style marks, outlined single-strand
  bases, read thickness by strand count, a coverage split by strand support,
  a hover showing the pair**: each needs non-consensus entries in the mismatch
  arrays, which coverage, sort-by-base, export and MAF read, or a per-instance
  channel through `pileupShape.ts` and `mismatch.slang`, for a few reads per
  site. "Strand" would also collide with forward/reverse everywhere else.
- **An "SBX duplex" per-base color scheme**: base-quality coloring already
  paints the classes; the scheme would add only a labeled legend, and lie on
  calibrated-QUAL BAMs.

Example data: Roche's GIAB SBX-D BAMs (HG001/HG002) from
`sequencing.roche.com/SBXdata` (download portal
`web.sbxdata.kamino.platform.navify.com`, behind a form). A 30 kb HG002 slice,
chr1:11,780,000–11,810,000 (MTHFR, 8,835 reads, indexed), is on ada at
`~/sbx/slices/HG002.chr1_11780000_11810000.bam`. The XOOS repo
(`github.com/Roche-AXELIOS/XOOS`) ships no small BAM fixtures; the spec's
worked examples (`4+13-3`, `+1WK1I1L+`, `+1KM3L+2`, `9++`) are the decoder's
unit cases.
