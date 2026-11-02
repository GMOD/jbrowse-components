---
name: sbx-duplex-yc-coloring
description: Roche SBX duplex reads carry a YC tag recording, per base, whether the two strands agreed, disagreed (and what each read) or only one covered. A per-base color scheme off a YC decoder, the decode in the feature detail panel, and optionally discordant positions as mismatch-style marks labeled by strand pair.
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
  one discordant position. The letter encodes the R1→R2 pair from a 5×5 table
  over `ACGT-`: `I P J X` are bases only in R1, `L Q O Z` bases only in R2, so
  a discordant position need not consume a consensus base on both sides.
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
that skip `-T YC` / `-C` drop it. Not yet confirmed by opening a downloaded BAM.

## QUAL is not a substitute

Demux writes the three classes into QUAL as fixed values (concordant Q39,
discordant Q5, simplex tail Q22), so **Color by → Base quality**
(`features/perBaseQuality`) shows the duplex layout on raw demux output today,
unlabeled. The read collapser, the next XOOS stage, rewrites QUAL with a
calibrated model (Q5–Q50) and the bins are gone. Whether `YC` survives the
collapser is not stated in its docs.

## Proposed, ranked

- **A `YC` decoder plus an "SBX duplex" per-base color scheme.**
  `features/perBaseQuality` and `features/perBaseLetter` are the template: an
  `extract.ts` reading the tag (`getTagAlt(feature, 'YC')`, the MM/ML idiom),
  orienting it to the record, and walking `forEachAlignedBaseInRegion`
  (`features/alignedBaseWalk.ts`) to emit per-ref-base classes, plus the
  overlay over the `normal` body. Register in `COLOR_FIELD_DEFS`
  (`shared/colorFieldDefs.ts`) and the `ColorFieldKind` union
  (`shared/types.ts`), which fails to compile until it has a shader path and
  menu placement. Legend: concordant, discordant, simplex tail.
- **The decode in the feature detail panel**
  (`AlignmentsFeatureDetail/tagInfo.ts`). Today `YC` is a raw string; render
  the tail lengths and owning strand, the concordant count, and each
  discordant position as its R1/R2 pair. Shares the decoder.
- **(Optional) Discordant positions as mismatch-style marks**, labeled by the
  R1/R2 pair, so they show without switching color schemes. Only if per-base
  coloring proves too subtle at genome scale.

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
