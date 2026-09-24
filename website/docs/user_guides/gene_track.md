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
color each transcript from a value carried in the file, and reshape the view
around a gene by collapsing its introns.

## Choosing which transcripts to show

The **Gene glyph** option in the track menu controls how a gene's transcripts
are drawn:

- Auto (default) - stacks every transcript zoomed in, collapses each gene to one
  transcript zoomed out, and keeps only as many isoforms per gene as the track's
  height has rows for
- All transcripts - every transcript on its own row, whatever the zoom or track
  height. A stack taller than the track scrolls
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

<Figure caption="Collapsing introns on PTEN (hg38). Top: the right-click menu. Bottom: the reshaped view with the exons side by side, where the direct-RNA nanopore track's sashimi arcs now span between adjacent exons." src="/img/gene_track_collapse_introns.png" />

## Display density and labels

Track-menu toggles:

- Display mode - _Normal_, _Compact_, or _Super-compact_ feature heights
- Show subfeature labels - each transcript's name on its row
- Show chevrons - strand chevrons along the intron lines (on by default)
- Show only genes - hides non-gene features
- Group by... - opens a dialog. _Strand_ packs the forward-strand features into
  one labelled section above the reverse-strand ones, unstranded features last,
  so convergent and divergent neighbours read apart. _Attribute_ takes a feature
  attribute, `biotype` or `source` say, and packs one section per value, with
  the features carrying none last

## Grouping features into sections

Each section carries a chip naming it, and the × on a chip hides that section.
The **Show N hidden** chip at the top of the track, or **Show... → Show N hidden
groups**,<!-- menu-path-ok --> puts every hidden section back, and changing the
grouping clears them. **Sections** in the track menu lists the sections drawn,
each with **Move up**, **Move down** and **Hide section**, and **Reset section
order** returns them to the sorted order.

<Video src="/media/ui/gene_track_sections.mp4" caption="NCBI RefSeq genes on hg38 grouped and colored by gene_biotype from Group by..., with lncRNA and pseudogene in near-identical greens. Sections then moves protein_coding to the top, and Color by... → Pin distinct colors gives each biotype a distinct color." />

The `facet` setting pre-groups a track, so a shared link opens grouped. As a
string it names the field: a feature attribute, a dotted path into a structured
one such as `INFO.SVTYPE`, or `strand`. As an object it adds the section order,
`{ "field": …, "domain": [...] }`: the values listed stack first, in that order,
and the rest follow sorted. A reorder from the menu writes the same setting, so
what a config author declares and what a reader arranges are one setting:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ncbi_refseq_hg38",
  "name": "NCBI RefSeq genes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://example.com/GCF_000001405.40.gff.gz"
  },
  "displayDefaults": {
    "facet": {
      "field": "gene_biotype",
      "domain": ["protein_coding", "lncRNA", "pseudogene"]
    }
  }
}
```

The dialog's **Also color by strand** (or **by this attribute**) colors each
section by its value: red and blue by strand, or one color per value, with a key
naming them. It starts ticked unless the track already has a color of its own,
and unticking it returns the default color.

<Figure caption="NCBI RefSeq genes on hg38 grouped and colored by strand, one representative transcript per gene. The forward-strand section stacks above the reverse-strand one, each under its chip and in its strand's color." src="/img/gene_track_group_by_strand.png" />

### Writing the grouping as JSON

**Edit as JSON...**, at the foot of the Group by and Color by attribute dialogs,
opens the track's grouping, color and filter as three channels. `facet` and
`color` are the display's two settings of those names, in the shape a config
file takes them: `facet` stacks a section per value of a field, in the order its
`domain` lists; `color` is a CSS color or a jexl expression, or `{ "field": … }`
for one color per value; `filter` is the list of jexl expressions **Filter
by...** edits. Applying a spec changes only the channels it names, an object
replaces the setting whole, and `null` clears one. Each of these pastes as it
is:

- `{ "facet": "strand" }` one section per strand
- `{ "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] } }`
  a section per biotype, these two first
- `{ "color": { "field": "source" } }` one color per source
- `{ "color": { "field": "strand" } }` forward strand red, reverse blue
- `{ "color": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } }`
  those two biotypes blue and orange, and every other its own color
- `{ "color": "#1f77b4" }` one color for everything
- `{ "filter": ["feature.type == 'gene'"] }` genes only
- `{ "facet": null, "color": null }` ungrouped, default color

The dialog lists the same examples. This one groups by biotype in a chosen
order, gives each of the four biotypes its own color, and leaves the track's
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

<Video src="/media/ui/gene_track_channel_spec.mp4" caption="NCBI RefSeq genes on hg38: Edit as JSON from the Group by dialog, the spec above pasted in, and the sections stacked in the facet's domain order, each biotype colored by its position in the color's domain." />

A color by a field is the `color` setting's `{ "field", "domain", "range" }`
form, and the track draws a key from the values it painted. Every value keeps a
color derived from itself, so a pan or a reload paints it the same; a `domain`
spends the `range` colors on the values it lists, in order, and a value it
leaves out never takes one of their colors. Two unlisted values can share a
color, and **Color by... → Pin distinct colors** lists every value the key shows
in the color's `domain`, in its order, so each takes its own. A transcript and
all its parts paint the transcript's value, or its gene's where the transcript
has none. `strand` is a field too, painting forward tomato and reverse
cornflowerblue unless a domain or range says otherwise. Each channel is the same
setting its menu writes, so the Sections menu reorders a facet written this way.

## Color by CDS

**Show... → Show CDS reading frame colors**, in the linear genome view's
hamburger menu, tints each CDS segment by the frame it is read in, so one colour
is one frame across the view. Frame is constant within a segment, so a colour
change across a junction is a frame shift. The setting applies to every gene
track in the view, and JBrowse remembers it across sessions.

<Figure caption="Turning on Color by CDS for BRCA1 (hg19). Top: the hamburger menu with the 'Show CDS reading frame colors' toggle. Bottom: the result at base-pair resolution, each codon tinted by its reading frame with its amino acid and protein position drawn over it." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The [`color`](/docs/config/featurecolor) object binds a field in the GFF3
attribute column to a scale. Under `categorical` each value takes its own color;
under `threshold` a number takes the color of the interval it falls in, between
the cut points `domain` lists, with one `range` color per interval. A
transcript's exons, CDS and UTRs paint the transcript's value, and a UTR follows
`color` unless `utrColor` overrides it.

- **JBrowse lowercases attribute names.** `dIF=0.79` reads under the key `dif`,
  so the field is `dif`
- **A transcript with no value paints grey**, keyed as `(no value)`. The
  tutorial below writes its effect size only on the transcripts its test called,
  so the rest stay grey

The key lists every interval and draws over the track, and you can dismiss it.
For a rule no scale expresses, `color` also takes a jexl expression; see the
[jexl configuration guide](/docs/config_guides/jexl).

<Figure caption="ATP5F1C in the hosted differential-transcript-usage demo (hg38): ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon, which only one of the two colored transcripts includes." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

The [differential transcript usage tutorial](/docs/tutorials/dtu) has the track
configuration behind that figure and the pipeline that writes the attributes.

## Peptide lettering

The track draws the translated protein on coding features by default. Zooming
in, the amino acids first appear as alternating per-codon shading, then at
roughly base-pair resolution as single-letter code over each codon, in register
with the reference sequence track. Turn off **Show amino acids when zoomed in**,
in the view menu's **Show...** submenu, to keep the view from fetching the
reference.

The translation follows the transcript's strand and CDS phase, splitting codons
that straddle an exon boundary. A CDS with a `transl_table` attribute (NCBI
convention, e.g. `transl_table=2` for vertebrate mitochondria) translates with
that code. The first codon shows as `M` when it is a valid start for that table
(including `GTG` or `TTG`); the track applies and highlights any `transl_except`
override (e.g. selenocysteine `U`).

<Figure caption="The selenoprotein GPX1 on hg19. Its in-frame UGA codon is recoded to selenocysteine via the GFF transl_except attribute, so codon 49 draws as a highlighted U. The reference sequence track's plain six-frame translation above still shows a stop there." src="/img/gene_track_selenocysteine.png" />

## Mature peptides (polyproteins)

Many viral genomes encode one polyprotein cleaved into mature peptides. When a
CDS has `mature_protein_region` (or `mature_protein_region_of_CDS`) subfeatures,
the track draws each cleavage product as a separate stacked row in a distinct
color, hoverable and clickable. Its name comes from the `product` attribute when
the track's `labels.name` reads it:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "enterovirus_d_genes",
  "name": "Genes",
  "assemblyNames": ["GCF_000861205.1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://example.com/GCF_000861205.1.gff.gz"
  },
  "displayDefaults": {
    "labels": {
      "name": "jexl:feature.product || feature.name || feature.id"
    }
  }
}
```

See the [jexl configuration guide](/docs/config_guides/jexl) for the expression
syntax.

<Figure caption="The enterovirus D (GCF_000861205.1) ORF1 polyprotein. The CDS is cleaved into its mature peptides (VP0, VP1–VP4, the 2A–2C and 3A–3D proteins), each on a separate row in a distinct color; hovering a region shows its product name." src="/img/gene_track_mature_peptides.png" />

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
large" message with a **Force load** button. A track can carry a sidecar
instead: a bigWig of feature counts per kilobase, built once from the file,
drawn as a band wherever the features are too many to fetch. The band names its
peak in its corner, and hovering reads the count under the cursor.

<Figure src="/img/gene_density_chr1.png" caption="Chromosome 1 with the RefSeq curated genes and three RepeatMasker families, each drawn from its density sidecar. Each band is that track's features per kilobase, scaled to its own peak." />

`jbrowse make-density` writes the sidecar beside the file, and
`jbrowse add-track` attaches one it finds there; `--density` names one
elsewhere. What it writes is the `densityAdapter` slot on the track's adapter:

```bash
jbrowse make-density genes.gff3.gz --chrom-sizes hg38.chrom.sizes
jbrowse add-track genes.gff3.gz --load copy
```

The track menu's **Density band** submenu: **Automatic** swaps where the fetch
would be too large, **Features only** keeps the message, **Density only** always
draws the band. While the band is standing in for a fetch that was too large,
the same submenu carries **Load features anyway**, the banner's force-load. See
the [gene density tutorial](/docs/tutorials/gene_density).

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/feature_sequence)
- [](/docs/config_guides/grouping_and_ordering)
- [RNA-seq tutorial](/docs/tutorials/rnaseq)
- [Track configuration](/docs/config_guides/tracks)
