---
name: ccr5-delta32-allele-tutorial-draft
description: Draft of a CCR5 Δ32 tutorial whose reader builds the deletion allele from a 1000 Genomes sample with bcftools consensus and minimap2, then opens it as a synteny track under hg38. The route is verified end to end; what waits is whether the site wants the page and where the allele's gene model comes from.
---

# CCR5 Δ32 allele tutorial (draft, not on the site)

- **In:** a phased 1000 Genomes VCF and an hg38 slice
- **Out:** the sample's Δ32 haplotype as its own assembly, aligned under hg38 in
  a linear synteny view

## What is verified (2026-10-22)

Every step ran on this machine against the live EBI panel.

| Step | Result |
| --- | --- |
| Slice of the phased panel, chr3:46,368,001-46,379,000 | 248 records, header included |
| `bcftools consensus -H 1 -s HG00137` on the hg38 slice | 10,968 bp, "Applied 4 variants": rs333 and three SNVs |
| `minimap2 -x asm5 -c` of the slice against the allele | one block, `cg:Z:5452M32I5516M`; the hosted demo's PAF has the same 5452 and 5516 |
| `translate(allele CDS)` | 215 residues, first change at residue 185, 31 novel residues, stop as codon 216; same as `demos/ccr5/` |
| `LinearSyntenyView` over a local release app | the 32 bases draw as the wedge between the two rows |

HG00137 is Δ32/Δ32, so `-H 1` and `-H 2` give the same allele. HG00101 (Δ32/+)
carries Δ32 on haplotype 2 only (haplotype 1 came out 10,991 bp), so a heterozygote
needs the phase read first.

## Settled against the previous agent's outline

- **Align to the 11 kb slice, not to chr3.** The slice is the minimap2 target
  and `awk` shifts the PAF into hg38 coordinates. No chr3 index, so the "1 to 2
  minutes and a couple of GB" cost never applies.
- **Put hg38 first in the aligner call** (`minimap2 allele.fa hg38_slice.fa`)
  so hg38 is the PAF query and the top row, as in the hosted demo. The shift then
  touches columns 1 to 4.
- The reader's figures come from the reader's allele, which carries the sample's
  other SNVs; the hosted demo allele does not. Both give the same protein.
- The block is one alignment with a `32I`, where the demo has two blocks and a
  gap. Both draw a pinch; the `indels` part decides the look.

## Draft page

Opening, to follow `website/docs/tutorials/CLAUDE.md`:

> A 32-base deletion in _CCR5_ (rs333, Δ32) shifts the reading frame and stops
> the receptor early. People with two copies resist the R5 strains of HIV,
> which enter cells through it. A phased VCF says who carries it; the sequence
> of the carrier's chromosome says what it does. We:
>
> - cut the carrier's haplotype out of a phased VCF with `bcftools consensus`
> - align it back to hg38 with `minimap2`
> - open the two as a linear synteny view
> - read the shifted frame off the allele's sequence

### Prerequisites

bcftools, minimap2, samtools, tabix (TUTORIAL_INSTALL marker pair for each).

### The data

Streamed, nothing to download by hand: the EBI phased panel
(`1kGP_high_coverage_Illumina.chr3.filtered.SNV_INDEL_SV_phased_panel.vcf.gz`
and its `.tbi`) and the UCSC sequence API for the hg38 slice. The S3 copies of
the 2020 VCFs are empty; use the 2022 panel.

### Steps

Cut the region out of the panel. `bcftools view -r` reads the remote panel
directly (checked with bcftools 1.24) and leaves its `.tbi` in the working
directory:

```bash
URL=https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr3.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
bcftools view -r chr3:46368001-46379000 -Oz -o slice.vcf.gz "$URL"
tabix -p vcf slice.vcf.gz
```

Fetch the hg38 slice, named with its coordinates so `bcftools consensus` shifts
the variants onto it:

```bash
curl "https://api.genome.ucsc.edu/getData/sequence?genome=hg38;chrom=chr3;start=46368000;end=46379000" |
  python3 -c "import json,sys; s=json.load(sys.stdin)['dna'].upper(); print('>chr3:46368001-46379000'); print(s)" > hg38_slice.fa
samtools faidx hg38_slice.fa
```

Build the carrier's haplotype and give its contig a name without a colon (the
header `bcftools consensus` keeps would break a locstring):

```bash
# HG00137 is Δ32/Δ32; -H picks the phased haplotype
bcftools consensus -f hg38_slice.fa -s HG00137 -H 1 slice.vcf.gz |
  awk '/^>/{print ">chr3_HG00137_h1"; next} 1' > allele.fa
```

Align hg38 to it and move the PAF onto chr3 coordinates:

```bash
minimap2 -x asm5 -c allele.fa hg38_slice.fa |
  awk 'BEGIN{OFS="\t"} {$1="chr3"; $2=198295559; $3+=46368000; $4+=46368000; print}' > hg38_vs_allele.paf
```

Compress and index the allele, then add it as an assembly (`BgzipFastaAdapter`)
beside hg38, and the PAF as a `SyntenyTrack` (`PAFAdapter`, `queryAssembly:
hg38`, `targetAssembly: HG00137_h1`). The shape is the hosted
`demos/ccr5/config.json` with the allele's own files.

```bash
bgzip -i -I allele.fa.gz.gzi -c allele.fa > allele.fa.gz
samtools faidx allele.fa.gz
```

Figure: the synteny view at chr3:46,373,400-46,373,540 over
`chr3_HG00137_h1:5,400-5,540`. The run served the files next to a v5 build and
read the capture; the wedge sits at the deletion.

## Open calls

1. **Does the site want this page?** The route is a genuine reader task, but the
   protein story already has three CCR5 figures in `genomes_proteins`.
2. **The allele's gene model.** The hosted figures label "31 novel residues" and
   "premature stop" from a hand-built GFF
   (`/var/tmp/ccr5/bin/frameshift.py`, `build_ccr5_delta32.py`). The reader's
   route has no equivalent, so the allele row shows sequence only. Options: drop
   the annotation and let the sequence track's translation carry the stop
   (unchecked at base level); give the reader a short script that re-derives the
   CDS on the allele, which is the step `a-variant-haplotype-is-a-lane` wants
   built into JBrowse; or point at the hosted GFF, which is the demo's allele.
3. **Heterozygotes.** Showing both haplotypes of HG00101 needs two assemblies
   and a phase check. Probably a second page.
4. **Reads.** The reads track in the combo figure is the three 30x CRAMs over
   S3 (`thousand-genomes-30x-crams-stream-from-s3`). A tutorial would open one
   and sort on the deletion before building the allele.
