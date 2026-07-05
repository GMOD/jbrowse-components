---
title: Introgression tracts
description:
  Painting per-individual archaic (Neanderthal/Denisovan) introgression segments
  as one labeled row per haplotype with the multi-row feature display
guide_category: Tutorials
---

Archaic introgression — the Neanderthal and Denisovan ancestry carried by
present-day humans — is inferred by dedicated population-genetics tools, not by
the genome browser. A caller like
[hmmix](https://github.com/LauritsSkov/Introgression-detection) reads a
multi-sample VCF and emits, _per individual haplotype_, the genomic segments it
calls as archaic, each classified by source. That output is exactly the shape
JBrowse draws well: intervals, one labeled row per haplotype.

This tutorial builds the JBrowse demo's introgression track: take a published
per-haplotype archaic-segment callset, reshape it into a single **multi-row
feature track** — one row per haplotype, painted by inferred source — and read
the tracts off the rows. JBrowse does no inference; it displays what the caller
decided.

<Figure src="/img/introgression.png" caption="Per-haplotype archaic introgression segments from an hmmix HGDP callset, one row per haplotype, colored by source: Neanderthal (red), Denisovan (blue), both (purple). The two Oceanian individuals (Bougainville, PapuanHighlands) carry conspicuously more Denisovan segments than the European, East Asian, and American individuals — the classic Denisovan-in-Oceania signal."/>

## The idea: the caller does the analysis, the browser shows the tracts

The division of labor matters. Detecting introgression means modeling private
variant density along the genome (hmmix uses an HMM against an unadmixed
outgroup), then classifying each archaic segment by comparison to sequenced
archaic genomes (Altai, Vindija, Denisova, Chagyrskaya). All of that happens in
the caller. What reaches the browser is a plain table of segments per haplotype,
which we reshape into one file with a per-haplotype label column and let the
**multi-row feature display** split back into a labeled sub-row — the same recipe
the [ChromHMM tutorial](/docs/tutorials/chromhmm) uses to stack cell types.

## 1. Get the segment calls

We use the published hmmix callset for the
[HGDP](https://www.internationalgenome.org/data-portal/data-collection/hgdp) and
1000 Genomes panels (hg38 coordinates, CC-BY 4.0), on
[Zenodo](https://doi.org/10.5281/zenodo.14136628):

```bash
curl -LO "https://zenodo.org/records/14136628/files/hg38_HGDP_segments.txt?download=1"
```

Each line is one archaic segment for one haplotype:

```
name       haplotype  pop     region  chrom  start    end      mean_prob  ND_type      snps  ...
HGDP00548  hap1       PapuanHighlands  OCEANIA  chr1  911000  940000  0.96174  Denisova  ...
```

`ND_type` is the inferred source (`Neanderthal`, `Denisova`, `Both`, or `none`
for archaic-state segments that match no sequenced archaic). To run the caller
yourself instead of downloading calls, follow hmmix's
[1000 Genomes walkthrough](https://github.com/LauritsSkov/Introgression-detection)
(`create_outgroup → mutation_rate → create_ingroup → train → decode -admixpop`);
its `decode` output has these same columns.

## 2. Reshape into one multi-row file

Keep the classified archaic segments for a handful of individuals spanning
regions, label each row `<pop> <hap>`, and carry the source through so the
display can color by it. One `awk` does the whole reshape:

```bash
awk -F'\t' 'BEGIN{OFS="\t"}
  NR>1 \
  && ($1=="HGDP00511"||$1=="HGDP00774"||$1=="HGDP00995"||$1=="HGDP00548"||$1=="HGDP00491") \
  && ($9=="Neanderthal"||$9=="Denisova"||$9=="Both") {
    # cols: 1 name 2 hap 3 pop 4 region 5 chrom 6 start 7 end 8 mean_prob 9 ND_type
    print $5, $6, $7, $9, int($8*1000), ".", $3" "$2, $9, $8, $3, $4
  }' hg38_HGDP_segments.txt \
  | sort -k1,1 -k2,2n > introgression.multirow.bed

bgzip introgression.multirow.bed
tabix -p bed introgression.multirow.bed.gz
```

The five individuals are one each from Europe (French), East Asia (Han), the
Americas (Karitiana), and two from Oceania (Bougainville, PapuanHighlands) — the
Oceanian pair carries the Denisovan signal. Each line is BED6 plus three trailing
fields — `sample` (the `<pop> <hap>` row label), `source`, and `meanprob` — which
drive the rows and colors below.

## 3. Configure the multi-row feature display

Add a `FeatureTrack` with a `BedTabixAdapter` whose `columnNames` name the extra
fields, and a `LinearMultiRowFeatureDisplay` that partitions on `sample`:

```json
{
  "type": "FeatureTrack",
  "trackId": "hgdp_archaic_introgression",
  "name": "Archaic introgression (hmmix, HGDP selected individuals)",
  "assemblyNames": ["hg38"],
  "category": ["1000 Genomes", "Introgression"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "sample",
      "source",
      "meanprob",
      "pop",
      "region"
    ],
    "bedGzLocation": {
      "uri": "https://jbrowse.org/demos/introgression/introgression.multirow.bed.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/introgression/introgression.multirow.bed.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "hgdp_archaic_introgression-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "color": "jexl:get(feature,'source')=='Denisova' ? '#2c7fb8' : get(feature,'source')=='Both' ? '#756bb1' : '#e34a33'",
      "rowOrder": [
        "French hap1",
        "French hap2",
        "Han hap1",
        "Han hap2",
        "Karitiana hap1",
        "Karitiana hap2",
        "Bougainville hap1",
        "Bougainville hap2",
        "PapuanHighlands hap1",
        "PapuanHighlands hap2"
      ],
      "rowHeight": 20
    }
  ]
}
```

The three fields that make this work are the same ones the ChromHMM track uses:

- **`partitionField: "sample"`** — every distinct `sample` value becomes its own
  labeled sub-row, so a 5-individual × 2-haplotype file draws as 10 stacked rows.
- **`color`** — a [jexl](/docs/config_guides/jexl) callback mapping each
  segment's inferred `source` to a color: Denisovan blue, both purple,
  Neanderthal red. Swap in `get(feature,'meanprob')` to shade by the caller's
  posterior instead. This colors _features_ by source; there's no built-in
  legend for it, so state the mapping in the track name or figure caption. (The
  separate `sampleColorMap` slot colors whole _rows_ by sample — a different
  axis, not a substitute for per-segment source coloring.)
- **`rowOrder`** — pins the haplotypes, grouped by region so the Oceanian rows
  (Denisovan-rich) sit together at the bottom.
- **`rowHeight`** — a fixed 20px per row here; the default `0` instead auto-fits
  every row into the display height (denser as you add individuals). Fixed
  height keeps the 10-row demo legible.

## What the tracts show

Zoom out to a whole chromosome and the biology reads straight off the rows: the
European, East Asian, and American haplotypes are painted almost entirely red
(Neanderthal), while the two Oceanian individuals — Bougainville and
PapuanHighlands — carry a heavy scattering of blue **Denisovan** tracts on top of
their Neanderthal segments. Denisovan ancestry concentrated in Oceania (and
largely absent elsewhere) is one of the most robust results in the field; here
it's simply the difference between the bottom four rows and the rest, no
statistics required of the reader.

## Windowed scores instead of tracts: multi-wiggle

Some callers emit a _per-window score_ per sample rather than discrete segments
(e.g. Sprime scores, or windowed D / f-statistics). That shape is a wiggle, not
an interval — convert each sample's windows to bedGraph/bigWig and load them
into a [multi-wiggle](/docs/user_guides/multiwiggle) track for one signal row
per sample. Tracts (above) are the more legible primary view; the windowed
signal is a useful companion.

## The same pattern, beyond humans

Nothing here is human-specific. Any introgression caller that outputs
per-individual segments — the classic adaptive-introgression stories of
[_Heliconius_ wing-pattern loci](https://doi.org/10.1038/nature11041) or the
[_Anopheles gambiae_ malaria-vector complex](https://doi.org/10.1126/science.1258524)
among them — reshapes into the same one-row-per-sample multi-row track. Point the
assembly at the relevant reference genome and the recipe is unchanged.

## Data and attribution

The archaic-segment calls are the hmmix HGDP/1000 Genomes callset of Skov et al.,
distributed under CC-BY 4.0 at
[doi:10.5281/zenodo.14136628](https://doi.org/10.5281/zenodo.14136628). The
method is described in Skov et al., _Detecting archaic introgression using an
unadmixed outgroup_ (PLoS Genetics, 2018).
