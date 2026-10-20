---
title: Gene track
description:
  Transcript display modes, collapsing introns, color by CDS reading frame,
  coloring transcripts from a file attribute, peptide lettering, and mature
  peptides on gene/transcript tracks
guide_category: Track types
---

Gene and transcript features (GFF3, GTF, BED12, and similar) render as glyphs
with their exons, UTRs, and CDS segments. Beyond that the track can translate
the CDS in place (reading frame colors, amino-acid lettering, mature peptides),
color each transcript from a value stored in the file, and reshape the view
around a gene by collapsing its introns.

## Choosing which transcripts to show

The **Gene glyph** option in the track menu controls how a gene's transcripts
are drawn:

- Auto (default) - stacks every transcript zoomed in, collapses each gene to one
  transcript zoomed out, and keeps only as many isoforms per gene as the track's
  height has rows for
- All transcripts - every transcript in a separate row, whatever the zoom or
  track height. A stack taller than the track scrolls
- Representative transcript - one isoform per gene

The representative isoform is the one the annotation tags: `RefSeq Select` or
`MANE Select` (NCBI), `MANE_Select` or `Ensembl_canonical` (Ensembl, GENCODE).
It is also drawn first when a gene is stacked. Without a tag, it is the longest
by protein length, or by genomic span for a gene with no coding isoform. The
`canonicalTranscriptField` and `canonicalTranscriptTags` config slots name the
attribute and tags.

A gene drawn with fewer transcripts than it has shows **+N more** beside its
name. Clicking it opens that one gene, and the badge then reads **show fewer**.
The **Gene glyph** submenu grows a row to re-collapse every gene opened this
way. The badge appears wherever the gene is wide enough on screen to hold it.

While the display leaves transcripts out, a chip in the track's bottom-right
corner names the rule: `Isoforms trimmed` where the track's height is the
constraint, otherwise the tag responsible for most genes on screen
(`RefSeq Select`, `MANE Select`, or `Longest isoform`). Its tooltip counts the
genes under each rule. Clicking it opens the same three modes.

## Collapsing introns

**Collapse introns**, from a gene's right-click menu, replaces the view's
displayed regions with that gene's exons side by side. A window-size setting
keeps some flanking sequence around each splice boundary. Right-clicking a
transcript offers that isoform as well as the whole gene (exons unioned), and
the dialog's transcript dropdown reaches an isoform that isn't drawn.

With an [RNA-seq track](/docs/tutorials/rnaseq), the spliced reads' **sashimi
arcs** then span directly between adjacent exons.

<Figure caption="Collapsing introns on PTEN. Top: the right-click menu. Bottom: the exons side by side, the sashimi arcs spanning between them." src="/img/gene_track_collapse_introns.png" />

## Display density and labels

Track-menu toggles:

- Display mode - _Normal_, _Compact_, or _Super-compact_ feature heights
- Show subfeature labels - each transcript's name on its row
- Show... → Chevrons - strand chevrons along the intron lines (on by default)
- Filter by... → Genes - _Only genes_ hides non-gene features, _Hide genes_ the
  genes
- Group by... - _Strand_ packs the forward-strand features into one labelled
  section above the reverse-strand ones, unstranded features last, so convergent
  and divergent neighbours read apart. _Attribute..._ opens a dialog for a
  feature attribute, `biotype` or `source` say, and packs one section per value,
  with the features with none last

## Grouping features into sections

Each section has a chip naming it, and the × on a chip hides that section. The
**Show N hidden** chip at the top of the track, or **Show... → Show N hidden
groups**,<!-- menu-path-ok --> puts every hidden section back, and changing the
grouping clears them. Drag a chip onto another section to move its section
there; **Show... → Reset section order** returns them to the sorted order.

<Video src="/media/ui/gene_track_sections.mp4" caption="NCBI RefSeq genes grouped and colored by gene_biotype from Group by..., then the protein_coding chip dragged to the top." />

The `facet` setting pre-groups a track, so a shared link opens grouped. As a
string it names the field: a feature attribute, a dotted path into a structured
one such as `INFO.SVTYPE`, or `strand`. As an object it adds the section order,
`{ "field": …, "domain": [...] }`: the values listed stack first, in that order,
and the rest follow sorted. A chip drag writes the same setting, so what a
config author declares and what a reader arranges are one setting:

```json addtrack
{
  "trackId": "ncbi_refseq_hg38",
  "name": "NCBI RefSeq genes",
  "uri": "https://example.com/GCF_000001405.40.gff.gz",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "facet": {
      "field": "gene_biotype",
      "domain": ["protein_coding", "lncRNA", "pseudogene"]
    }
  }
}
```

Grouping also colors each section by its value, red and blue by strand or one
color per attribute value, with a key naming them, unless the track already sets
a color. The attribute dialog's **Also color by this attribute** box makes that
choice by hand.

<Figure caption="NCBI RefSeq genes grouped and colored by strand." src="/img/gene_track_group_by_strand.png" />

### Writing the grouping as text

**Advanced → Edit plot...** in the track menu, also a button at the foot of the
Group by and Color by attribute dialogs, opens the track's grouping, color and
filter as text ([](/docs/user_guides/edit_plot)). `facet` and `color` are the
display's two settings of those names, in the shape a config file takes them:
`facet` stacks a section per value of a field, in the order its `domain` lists;
`color` is a CSS color or a jexl expression, or `{ "field": … }` for one color
per value; `filter` is the list of jexl expressions **Filter by...** edits.
Applying a spec changes only the channels it names, an object replaces the
setting whole, and `null` clears one. Each of these pastes as it is:

- `{ "facet": "strand" }` one section per strand
- `{ "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] } }`
  a section per biotype, these two first
- `{ "color": { "field": "source" } }` one color per source
- `{ "color": { "field": "strand" } }` forward strand red, reverse blue
- `{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } }`
  those two biotypes blue and orange, and every other value a distinct color
- `{ "color": "#1f77b4" }` one color for everything
- `{ "filter": { "genes": "only" } }` genes only
- `{ "filter": ["jexl:feature.score > 100"] }` scores above 100
- `{ "facet": null, "color": null }` ungrouped, default color

The dialog lists the same examples. This one groups by biotype in a chosen
order, gives each of the four biotypes a distinct color, and leaves the track's
filter alone:

```json
{
  "facet": {
    "field": "gene_biotype",
    "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  },
  "color": {
    "field": "gene_biotype",
    "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  }
}
```

<Video src="/media/ui/gene_track_channel_spec.mp4" caption="Edit plot from the Group by dialog, the spec above pasted in, and the sections in the facet's domain order." />

A color by a field is the `color` setting's `{ "field", "domain", "range" }`
form, and the track draws a key from the values it painted. A `domain` spends
the `range` colors on the values it lists, in order, and a value it leaves out
never takes one of their colors. Every other value takes a distinct color the
first time the track shows it, and keeps it while the track is open; a value
that no other value competes with gets a color derived from the value, the same
on every reload. A transcript and all its parts take the transcript's value, or
its gene's where the transcript has none. `strand` is a field too, painting
forward tomato and reverse cornflowerblue unless a domain or range says
otherwise. Each channel is the same setting its menu writes, so the Sections
menu reorders a facet written this way.

## Color by CDS

**Show... → CDS reading frame colors**, in the linear genome view's hamburger
menu, tints each CDS segment by the frame it is read in, so one color is one
frame across the view. Frame is constant within a segment, so a color change
across a junction is a frame shift. The setting applies to every gene track in
the view, and JBrowse remembers it across sessions.

<Figure caption="Color by CDS on BRCA1. Top: the menu toggle. Bottom: each codon tinted by reading frame with its amino acid drawn over it." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The [`color`](/docs/config/featurecolor) object binds a field in the GFF3
attribute column to a scale. Under `categorical` each value takes a distinct
color; under `threshold` a number takes the color of the interval it falls in,
between the cut points `domain` lists, with one `range` color per interval. A
transcript's exons, CDS and UTRs take the transcript's value, and a UTR follows
`color` unless `utrColor` overrides it.

- **JBrowse lowercases attribute names.** `dIF=0.79` reads under the key `dif`,
  so the field is `dif`
- **A transcript with no value paints grey**, keyed as `(no value)`. The
  tutorial below writes its effect size only on the transcripts its test called,
  so the rest stay grey

The key lists every interval and draws over the track, and you can dismiss it.
For a rule no scale expresses, `color` also takes a jexl expression; see the
[jexl configuration guide](/docs/config_guides/jexl).

<Figure caption="ATP5F1C with muscle and liver RNA-seq coverage over GENCODE transcripts colored by satuRn's isoform-fraction change." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

The [differential transcript usage tutorial](/docs/tutorials/dtu) has the track
configuration behind that figure and the pipeline that writes the attributes.

## Peptide lettering

The track draws the translated protein on coding features by default. Zooming
in, the amino acids first appear as alternating per-codon shading, then at
roughly base-pair resolution as single-letter code over each codon, in register
with the reference sequence track. Turn off **Amino acids when zoomed in**, in
the view menu's **Show...** submenu, to keep the view from fetching the
reference.

The translation follows the transcript's strand and CDS phase, splitting codons
that straddle an exon boundary. A CDS with a `transl_table` attribute (NCBI
convention, e.g. `transl_table=2` for vertebrate mitochondria) translates with
that code. The first codon shows as `M` when it is a valid start for that table
(including `GTG` or `TTG`); the track applies and highlights any `transl_except`
override (e.g. selenocysteine `U`).

<Figure caption="GPX1 on hg19, its transl_except codon drawn as a highlighted U. The sequence track's six-frame translation above shows a stop there." src="/img/gene_track_selenocysteine.png" />

## Mature peptides (polyproteins)

Many viral genomes encode one polyprotein cleaved into mature peptides. When a
CDS has `mature_protein_region` (or `mature_protein_region_of_CDS`) subfeatures,
the track draws each cleavage product as a separate stacked row in a distinct
color, hoverable and clickable.

- The track names each row by its `product` attribute, which NCBI writes in
  place of a Name, and falls back to the track's `labels.name`.
- **Subfeature labels** in the Show menu sets the placement
  ([`subfeatureLabels`](/docs/config/linearbasicdisplay#slot-subfeaturelabels)).
  `Auto` names cleavage products only; `Off`, `Below` and `Overlay` apply to
  every part, transcripts included.

<Figure caption="An enterovirus polyprotein's mature peptides, each on its own row in its own color." src="/img/gene_track_mature_peptides.png" />

## Reading a feature's protein sequence

Click the feature and use the Sequence section of the details panel for the
protein, CDS, cDNA or genomic sequence. See
[](/docs/user_guides/feature_sequence).

## Using gene tracks with the Protein3d plugin

The [Protein3d plugin](/docs/tutorials/genomes_proteins) uses the same
transcript-to-protein mapping. Right click a gene and launch the protein
structure viewer for an interactive 3D structure (an AlphaFold model, a PDB
entry, or a file of your own) linked to the genome view: hovering a position
highlights the residue, and vice versa. See the
[proteins tutorial](/docs/tutorials/genomes_proteins) for launch routes and
installation.

## A whole chromosome of genes

Zoomed out far enough, a gene track stops fetching and shows a "region too
large" message with a **Force load** button. A bigWig of feature counts per
kilobase, built once from the file and added as a separate track, shows where
the genes are at any width.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with RefSeq genes and three RepeatMasker families, each as features per kilobase." />

`jbrowse make-density` writes the bigWig beside the file:

```bash
jbrowse make-density genes.gff3.gz --chrom-sizes hg38.chrom.sizes
jbrowse add-track genes.gff3.density.bw --load copy
```

See the [gene density tutorial](/docs/tutorials/gene_density).

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [](/docs/config_guides/grouping_and_ordering)
- [RNA-seq tutorial](/docs/tutorials/rnaseq)
- [Track configuration](/docs/config_guides/tracks)
