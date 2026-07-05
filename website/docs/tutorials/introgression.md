---
title: Introgression tracts
description:
  Painting per-haplotype archaic introgression segments as one labeled row per
  haplotype with the multi-row feature display
guide_category: Tutorials
---

Archaic introgression callers emit, per individual haplotype, the genomic
segments they call as Neanderthal- or Denisovan-derived. That output is a set of
intervals with a per-haplotype label and a source — exactly the shape the
**multi-row feature display** draws: one labeled row per haplotype, features
colored by source. This tutorial takes a published callset, reshapes it into one
BED, and configures the display. JBrowse does no inference; it draws the segments
the caller produced.

<Figure src="/img/introgression.png" caption="hmmix archaic-segment calls as a multi-row feature track: one row per haplotype, features colored by inferred source — Neanderthal (red), Denisovan (blue), both (purple). Whole chr1 arm, five individuals × two haplotypes; the four Oceanian rows (bottom) carry the blue Denisovan segments."/>

## 1. Get the segment calls

Use the published hmmix callset for the
[HGDP](https://www.internationalgenome.org/data-portal/data-collection/hgdp) and
1000 Genomes panels (hg38, CC-BY 4.0) on
[Zenodo](https://doi.org/10.5281/zenodo.14136628):

```bash
curl -LO "https://zenodo.org/records/14136628/files/hg38_HGDP_segments.txt?download=1"
```

Each line is one archaic segment for one haplotype:

```
name       haplotype  pop     region  chrom  start    end      mean_prob  ND_type      snps  ...
HGDP00548  hap1       PapuanHighlands  OCEANIA  chr1  911000  940000  0.96174  Denisova  ...
```

`ND_type` is the inferred source (`Neanderthal`, `Denisova`, `Both`, or `none`).
To generate calls yourself, hmmix's
[walkthrough](https://github.com/LauritsSkov/Introgression-detection)
(`create_outgroup → mutation_rate → create_ingroup → train → decode -admixpop`)
produces the same columns.

## 2. Reshape into one multi-row file

Keep the classified archaic segments for a few individuals, label each row
`<pop> <hap>`, and carry `source` through for coloring. One `awk`:

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
Americas (Karitiana), and Oceania (Bougainville, PapuanHighlands). Each output
line is BED6 plus three trailing fields — `sample` (the `<pop> <hap>` row label),
`source`, and `meanprob` — which drive the rows and colors.

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

The display config, field by field:

- **`partitionField: "sample"`** — every distinct `sample` value becomes its own
  labeled row, so the 10 `<pop> <hap>` values draw as 10 stacked rows.
- **`color`** — a [jexl](/docs/config_guides/jexl) callback coloring each
  _feature_ by its `source`. Use `get(feature,'meanprob')` instead to shade by
  the caller's posterior. There's no built-in legend, so put the color mapping in
  the track name or figure caption. (The `sampleColorMap` slot is a different
  axis — it colors whole rows by sample, not features by source.)
- **`rowOrder`** — pins the row order; omit it and rows fall back to first-seen
  order.
- **`rowHeight`** — fixed 20px per row; the default `0` auto-fits all rows into
  the display height.

## Zooming in

At a single locus the display only renders rows that have a feature in view —
rows with no segment there drop out.

<Figure src="/img/introgression_locus.png" caption="The same track zoomed to chr13:104.5–105.1 Mb, over NCBI RefSeq genes. Only the four Oceanian haplotypes appear — the other six carry no segment in this window, so their rows drop out — each with an overlapping ~150 kb Denisovan (blue) block."/>

## Windowed scores instead of tracts: multi-wiggle

Some callers emit a per-window score per sample rather than discrete segments
(Sprime scores, windowed D / f-statistics). That's a wiggle, not an interval:
convert each sample's windows to bedGraph/bigWig and load them into a
[multi-wiggle](/docs/user_guides/multiquantitative_track) track for one signal
row per sample.

## The same pattern, beyond humans

Any caller that outputs per-individual segments loads the same way — swap the
assembly and the input file, the track config is unchanged.

## Data and attribution

The archaic-segment calls are the hmmix HGDP/1000 Genomes callset of Skov et al.,
CC-BY 4.0, at
[doi:10.5281/zenodo.14136628](https://doi.org/10.5281/zenodo.14136628).
