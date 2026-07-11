---
title: Introgression tracts
description:
  Painting per-haplotype archaic introgression segments as one labeled row per
  haplotype with the multi-row feature display
guide_category: Tutorials
---

Archaic introgression callers emit, per individual haplotype, the genomic
segments they call as Neanderthal- or Denisovan-derived. That output is a set of
intervals with a per-haplotype label and a source, which is what the **multi-row
feature display** is built to draw: one labeled row per haplotype, features
colored by source. This tutorial takes a published callset, reshapes it into one
BED, and configures the display. JBrowse does no inference. It draws the
segments the caller produced.

<Figure src="/img/introgression.png" caption="hmmix archaic-segment calls as a multi-row feature track: one row per haplotype, features colored by inferred source — Neanderthal (red), Denisovan (blue), both (purple). Whole chr1 arm, five individuals × two haplotypes, grouped by region with the coloured spines at the left. The four Oceanian rows (blue spine) carry nearly all the Denisovan (blue) segments; Neanderthal (red) is spread across every population."/>

## Get the segment calls

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

## Reshape into one multi-row file

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
line is BED6 plus five trailing fields — `sample` (the `<pop> <hap>` row label),
`source`, `meanprob`, `pop`, and `region`; the first three drive the rows and
colors.

## Configure the multi-row feature display

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
  the caller's posterior. There's no built-in legend, so put the color mapping
  in the track name or figure caption. (The `sampleColorMap` slot is a different
  axis — it colors whole rows by sample, not features by source.)
- **`rowOrder`** — pins the row order. Ordering the rows by region (non-Oceanian
  first, Oceanian last) makes the Denisovan-in-Oceania pattern group visually,
  as in the figure above. Omit it and rows fall back to first-seen order.
- **[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight)** —
  set a fixed pixel height per row (e.g. 20); leave it unset to auto-fit all
  rows into the display height.

## A shared Denisovan tract: zooming to a locus

At a single locus the display only renders rows that have a feature in view —
rows with no segment there drop out. Zoom to a region where the Oceanian
haplotypes share a tract and the picture is unambiguous:

<Figure src="/img/introgression_locus.png" caption="chr2:96.55–97.15 Mb over NCBI RefSeq genes. A ~370 kb Denisovan block (blue) is present in all four Oceanian haplotypes and absent from the other six, whose rows drop out. The tract sits over the CNNM4 / CNNM3 / SEMA4C gene cluster. Melanesians carry the most Denisovan ancestry of any population — up to ~4–6% of their genome. (Vernot et al. 2016, Science)"/>

## The opposite signal: a Neanderthal tract shared by everyone

Denisovan ancestry is largely restricted to Oceania, but Neanderthal ancestry is
shared by every non-African population. The same track at a Neanderthal locus
shows the contrast — red appears in every population's rows:

<Figure src="/img/introgression_neanderthal.png" caption="chr12:129.95–130.32 Mb over FZD10. A Neanderthal segment (red) is called across French, Han, Karitiana, Bougainville and PapuanHighlands haplotypes alike — the signature of the Neanderthal ancestry shared by all non-Africans, unlike the Oceania-restricted Denisovan tracts above."/>

## The same pattern, beyond humans

Any caller that outputs per-individual segments loads the same way — swap the
assembly and the input file, the track config is unchanged.

## See also

- [ChromHMM chromatin states](/docs/tutorials/chromhmm) — the same multi-row
  feature display pattern, for per-cell-type chromatin states instead of
  per-haplotype segments
- [Phased trio analysis](/docs/tutorials/analyze_trio) — another multi-row
  painting technique, for hap-ibd inheritance blocks
- [jexl](/docs/config_guides/jexl) — the color callback syntax coloring features
  by inferred source

## Data and attribution

The archaic-segment calls are the hmmix HGDP/1000 Genomes callset of Skov et
al., CC-BY 4.0, at
[doi:10.5281/zenodo.14136628](https://doi.org/10.5281/zenodo.14136628).
