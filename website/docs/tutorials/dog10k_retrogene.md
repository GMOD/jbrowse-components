---
title: An expressed retrogene (Dog10K)
sidebar_label: Retrogene (Dog10K)
description:
  Read a processed retrocopy off the intron-shaped deletion calls a short-read
  caller leaves over its parent gene
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** slice two structural-variant records out of the Dog10K Manta callset
over HTTP, load them as a multi-sample variant track under the gene model, and
read an insertion that is nowhere near the window off the shape of the calls it
leaves behind.

## Prerequisites

To build the tracks:

- the `UU_Cfam_GSD_1.0` dog assembly set up in JBrowse (UCSC calls it canFam4)
- `bcftools` built with libcurl, `curl`, `python3`, and htslib (`tabix`)

## The variant that is not there

[Parker et al. (2009)](https://doi.org/10.1126/science.1173275) tied
breed-defining short legs to an expressed _FGF4_ retrogene: a processed copy of
the _FGF4_ transcript, reinserted somewhere else in the genome. Processed means
it was made from the spliced mRNA, so the copy has no introns.

That is what makes it findable without knowing where it landed. Short reads from
the retrocopy map to the parent gene, because the parent's exons are the
sequence they match, and they stop at each splice site. A short-read caller
reading that pileup sees exon coverage continuing past where the reference's
exons end, and calls a deletion of each intron.

Nothing is deleted. That reading comes from Parker et al. rather than from the
callset, which cannot tell a retrocopy's footprint from a real deletion on its
own; what the callset adds is below.

## The records are the introns

_FGF4_ has two introns, so a retrocopy should leave two records, each spanning
one intron end to end. That is checkable rather than assumed, so
[`build_dog10k_fgf4_retrogene.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_retrogene.sh)
derives the introns from the RefSeq annotation and asserts each record against
them before it writes any track, allowing one base of slack at each breakpoint:

```
FGF4 RefSeq exons:  48869443-48869782, 48870315-48870418, 48870953-48873311
FGF4 RefSeq introns: 48869783-48870314 (532 bp),  48870419-48870952 (534 bp)

intron 48869783-48870314: called as a DEL of 532 bp at 48869783-48870314
intron 48870419-48870952: called as a DEL of 534 bp at 48870418-48870951
```

A callset or annotation update that moved either one would fail the script
rather than quietly redraw the figure.

## Slicing the two records out of the callset

The Michigan aggregate callset is 1.08 GB over the whole collection with a tabix
index beside it, and `bcftools` reads only the window. Selecting on `POS` keeps
the two records and drops everything else called nearby:

```bash
SHARE=https://kiddlabshare.med.umich.edu/dog10K
SV=$SHARE/Manta-SV_2022-03-28/SV-genotype-v2.merge.agg_only.08032022.vcf.gz
bcftools view -r chr18:48865000-48876000 -S fgf4.samples --force-samples \
  -i 'POS=48869782 || POS=48870417' \
  -Oz -o dog10k_fgf4_svs.vcf.gz "$SV"
tabix -p vcf dog10k_fgf4_svs.vcf.gz
```

`fgf4.samples` is derived from the Dog10K sample table: whole breeds, not a few
animals each. Three breeds whose short legs are the trait Parker et al. mapped,
two spaniel breeds, two standard-proportioned breeds with no reported
association, and the Greek gray wolves.

## Loading it with sample metadata

The rows keep the Dog10K sample IDs, which are the data's identity but say
nothing to a reader. Rather than restate a label per animal wherever the track
is drawn, point the adapter at a TSV whose first column is the sample name:

```
name	label	breed	group
DACH000001	Dachshund 1	Dachshund	Chondrodysplastic breed
ACKR000001	Cocker Spaniel 1	Cocker Spaniel	Standard-proportioned breed
CLUPGR000001	Greek wolf 1	Greek gray wolf	Gray wolf
```

The build script writes that file from the sample table, so the mapping lives
beside the data. `colorBy` then names the column that paints the sidebar swatch:

```json
{
  "type": "VariantTrack",
  "trackId": "dog10k_fgf4_svs",
  "name": "Dog10K structural variants at FGF4 (named breeds)",
  "assemblyNames": ["UU_Cfam_GSD_1.0"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "dog10k_fgf4_svs.vcf.gz",
    "samplesTsvLocation": { "uri": "dog10k_fgf4_samples.tsv" }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "colorBy": "group",
      "height": 690
    }
  ]
}
```

Add the assembly's gene annotation above it. This figure needs the positional
display rather than the clustered matrix the other Dog10K tutorials use: the
whole claim is where the two blocks sit relative to the exons, and a matrix
spaces one even column per record, which throws that geometry away.

## Reading it

<Figure caption="Two Dog10K structural-variant records over FGF4, one row per canid, with the RefSeq gene model above. Each block lands in one of the gene's two intron gaps. Every Dachshund, Basset Hound, Cardigan Corgi, Cocker Spaniel and English Cocker carries both; the Labradors, German Shepherds and Greek wolves carry neither." src="/img/dog10k-fgf4-retrogene.png" />

The two blocks fall in the two gaps of the gene model above them, which is the
reason to draw this at a locus rather than as a table: an intron-shaped call is
a retrocopy's footprint, and an intron-shaped call is something you can see.

Every carrier here is heterozygous. The parent gene's introns are still on both
chromosomes, so the pileup a carrier produces is always a mixture and the caller
never sees the homozygous loss a real deletion would give it.

## What one record cannot tell you

Two _FGF4_ retrocopies are known in dogs. Parker et al. tied one to short legs;
[Brown et al. (2017)](https://doi.org/10.1073/pnas.1709082114) tied a second, on
a different chromosome, to chondrodystrophy and intervertebral disc disease,
which is why breeds of ordinary proportions carry a copy too.

Both are copies of the same transcript, so both leave the same footprint at the
parent gene, and one record here cannot say which. That is why the swatch says
what a breed looks like rather than what it carries: the spaniels are exactly
the rows where the two disagree, and a swatch keyed on the genotype would have
hidden them.

Placing the insertion needs the other side of the junction, reads spanning
retrocopy into flanking sequence, which is a different query against a different
callset.

## Across the collection

The same two records genotyped over every canid the callset carries, printed by
the build script:

```
Genotype counts per group, at the intron 1 record (chr18:48869782):
  Breed_Dogs     1575 canids: 1177 hom ref, 381 het, 12 no call, 5 hom alt
  Mixed/Other      12 canids: 10 hom ref, 2 het
  Village_Dogs    237 canids: 198 hom ref, 39 het
  Wolf             55 canids: 55 hom ref

  of 290 breeds with two or more animals: 52 carry it in every animal, 198 in none
```

No wolf in the collection carries it, which the twelve wolf rows in the figure
already show for the panel and this extends to all of them.

The script also genotypes the two records against each other:

```
  1831 of 1879 canids get the same call from both: 97.4%
  most common (intron 1, intron 2) pairs: (0/0, 0/0) x1422  (0/1, 0/1) x409
```

Manta called the two introns independently, so that agreement is a check on the
reading rather than a restatement of it. One retrocopy takes both introns out of
the pileup at once; a caller responding to noise would have no reason to put the
same animals on both records.

The whole-collection track is in the config as `dog10k_fgf4_cohort_svs` if you
want the lane, but it is not drawn here: 1,879 rows in a few hundred pixels puts
each row well under a pixel, where rows alias and the stripe density stops being
the carrier rate.

## Where to go next

The same shape finds other retrocopies. Any gene whose introns are all called
deleted in some animals and not others is a candidate, and the check is the one
this script runs: do the records match the annotated introns to the base.

## Reproduce it end to end

[`build_dog10k_fgf4_retrogene.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dog10k_fgf4_retrogene.sh)
runs every step:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dog10k_fgf4_retrogene.sh
bash build_dog10k_fgf4_retrogene.sh   # writes ./dog10k_fgf4_build/
```

It downloads the Dog10K sample table, derives the panel and the label TSV from
it, checks both records against the RefSeq introns, slices them out of the
callset for the panel and for the whole collection, and prints the genotype
counts and the two records' agreement quoted above.

## See also

- [SVs (Dog10K)](/docs/tutorials/dog10k_svs),
  [Loss-of-function allele (Dog10K)](/docs/tutorials/dog10k_lof),
  [Selected haplotype (Dog10K)](/docs/tutorials/dog10k_selection) and
  [Local ancestry (Dog10K)](/docs/tutorials/local_ancestry), the other Dog10K
  tutorials, on the same assembly
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/user_guides/sv_visualization)

## References

Parker, H. G., VonHoldt, B. M., Quignon, P., et al. (2009).
[An expressed fgf4 retrogene is associated with breed-defining chondrodysplasia in domestic dogs](https://doi.org/10.1126/science.1173275).
_Science_, _325_(5943), 995-998.

Brown, E. A., Dickinson, P. J., Mansour, T., et al. (2017).
[FGF4 retrogene on CFA12 is responsible for chondrodystrophy and intervertebral disc disease in dogs](https://doi.org/10.1073/pnas.1709082114).
_PNAS_, _114_(43), 11476-11481.

Meadows, J. R. S., Kidd, J. M., Wang, G.-D., et al. (2023).
[Genome sequencing of 2000 canids by the Dog10K consortium advances the understanding of demography, genome function and architecture](https://doi.org/10.1186/s13059-023-03023-7).
_Genome Biology_, _24_(1), 187.
