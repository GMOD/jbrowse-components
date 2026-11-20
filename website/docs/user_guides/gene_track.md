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

- **Auto** (default): stacks every transcript zoomed in, collapses each gene to
  one transcript zoomed out, and keeps only as many isoforms per gene as the
  track's height has rows for
- **All transcripts:** every transcript in a separate row, whatever the zoom or
  track height. A stack taller than the track scrolls
- **Representative transcript:** one isoform per gene

The representative isoform, drawn first when a gene is stacked, is:

- **Tagged:** the one the annotation tags, `RefSeq Select` or `MANE Select`
  (NCBI), `MANE_Select` or `Ensembl_canonical` (Ensembl, GENCODE)
- **Untagged:** the longest by protein length, or by genomic span for a gene
  with no coding isoform
- **Configured:** whatever the [`transcripts`](/docs/config/featuretranscripts)
  setting picks, by attribute (`transcripts.field`) and the tags that rank
  first, in order (`transcripts.sort`)

While the display leaves transcripts out:

- **+N more** beside a gene's name, wherever the gene is wide enough on screen
  to hold it, opens that one gene, and then reads **show fewer**. The **Gene
  glyph** submenu grows a row to re-collapse every gene opened this way
- **A chip** in the track's bottom-right corner names the rule:
  `Isoforms trimmed` where the track's height is the constraint, otherwise the
  tag responsible for most genes on screen (`RefSeq Select`, `MANE Select`, or
  `Longest isoform`). Its tooltip counts the genes under each rule, and clicking
  it opens the same three modes

## Collapsing introns

**Collapse introns...**, from a gene's right-click menu, replaces the view's
displayed regions with that gene's exons side by side.

- **Flank:** a window-size setting keeps some flanking sequence around each
  splice boundary
- **One isoform:** right-clicking a transcript offers that isoform as well as
  the whole gene (exons unioned), and the dialog's transcript dropdown reaches
  an isoform that isn't drawn. Picking one isoform opens the gene to all of them
- **Ruler:** each exon after the first is labeled with its first coordinate
- **Undo:** click **Undo** on the notice, or click the chromosome name on the
  ruler and choose its **Show the whole span** row. The **1 feature** chip on
  the gene track brings back the other genes

With an [RNA-seq track](/docs/tutorials/rnaseq), the spliced reads' **junction
arcs** then span directly between adjacent exons.

<Figure caption="Collapsing introns on PTEN. Top: the right-click menu. Bottom: the exons side by side, the junction arcs spanning between them." src="/img/gene_track_collapse_introns.png" />

## Display density and labels

Track-menu toggles:

- **Display mode:** _Normal_, _Compact_, or _Super-compact_ feature heights
- **Subfeature labels:** each transcript's name on its row, placed _Auto_,
  _Below_ or _Overlay_, or _Off_
- **Show → Show chevrons:** strand chevrons along the intron lines (on by
  default)
- **Filter by → Genes:** _Only genes_ hides non-gene features, _Hide genes_ the
  genes
- **Group by:** _Strand_ packs the forward-strand features into one labelled
  section above the reverse-strand ones, unstranded features last.
  _Attribute..._ opens a dialog for a feature attribute, `biotype` or `source`
  say, and packs one section per value, with the features with none last

## Grouping features into sections

Each section has a chip naming it:

- **Hide:** the × on a chip hides that section. The **Show N hidden** chip at
  the top of the track, or **Show → Show N hidden groups**,<!-- menu-path-ok -->
  puts every hidden section back, and changing the grouping clears them
- **Pick:** **Sections...** in the track menu lists every section the track
  knows, with a box each; untick the ones to hide, then **Apply**
- **Reorder:** drag a chip onto another section to move its section there;
  **Reset section order** in the track menu returns them to the sorted order

<Video src="/media/ui/gene_track_sections.mp4" caption="NCBI RefSeq genes grouped and colored by gene_biotype from Group by, then the protein_coding chip dragged to the top." />

The `facet` setting pre-groups a track, so a shared link opens grouped. As a
string it names the field: a feature attribute, a dotted path into a structured
one such as `INFO.SVTYPE`, or `strand`. As an object it adds the section order,
`{ "field": …, "sort": [...] }`: the values listed stack first, in that order,
and the rest follow sorted. A chip drag writes the same setting:

```json addtrack
{
  "trackId": "ncbi_refseq_hg38",
  "name": "NCBI RefSeq genes",
  "uri": "https://example.com/GCF_000001405.40.gff.gz",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "facet": {
      "field": "gene_biotype",
      "sort": ["protein_coding", "lncRNA", "pseudogene"]
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
filter as text ([](/docs/user_guides/edit_plot)), as the display's settings in
the shape a config file takes them:

- **`facet`** stacks a section per value of a field, in the order its `sort`
  lists
- **`encoding.color`** is a field for one color per value, or `{ "value": … }`
  holding a CSS color or a jexl expression
- **`filter`** is the list of tests **Filter by** edits: `jexl:` expressions
  that must hold, and `geneLike` for the gene-like features

The text is the whole plot, so a setting deleted from it returns to its default,
and `null` resets one. Each spec below changes the settings it names, written
over those settings in the text:

- `{ "facet": "strand" }` one section per strand
- `{ "facet": { "field": "gene_biotype", "sort": ["protein_coding", "lncRNA"] } }`
  a section per biotype, these two first
- `{ "encoding": { "color": "source" } }` one color per source
- `{ "encoding": { "color": "strand" } }` forward strand red, reverse blue
- `{ "encoding": { "color": { "field": "gene_biotype", "scale": { "domain": ["protein_coding", "lncRNA"], "range": ["#1f77b4", "#ff7f0e"] } } } }`
  those two biotypes blue and orange, and every other value a distinct color
- `{ "encoding": { "color": { "value": "#1f77b4" } } }` one color for everything
- `{ "filter": ["geneLike"] }` genes only
- `{ "filter": ["jexl:feature.score > 100"] }` scores above 100
- `{ "facet": null, "encoding": null }` ungrouped, default color

The dialog's example buttons lay several of these over the plot as it stands.
This one groups by biotype in a chosen order and gives each of the four biotypes
a distinct color; written over `facet` and `encoding`, it leaves the filter as
it was:

```json
{
  "facet": {
    "field": "gene_biotype",
    "sort": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  },
  "encoding": {
    "color": {
      "field": "gene_biotype",
      "scale": {
        "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
      }
    }
  }
}
```

<Video src="/media/ui/gene_track_channel_spec.mp4" caption="Edit plot from the Group by dialog, the spec above pasted in, and the sections in the facet's sort order." />

A color by a field is the `encoding.color` setting's
`{ "field", "scale": { "domain", "range" } }` form, and the track draws a key
from the values it painted:

- **Listed values:** a `scale.domain` assigns the `scale.range` colors to the
  values it lists, in order, and a value it leaves out never takes one of their
  colors
- **Other values:** each takes a distinct color the first time the track shows
  it, and keeps it while the track is open; a value that no other value competes
  with gets a color derived from the value, the same on every reload
- **Transcripts:** a transcript and all its parts take the transcript's value,
  or its gene's where the transcript has none
- **Strand:** `strand` is a field too, painting forward tomato and reverse
  cornflowerblue unless a domain or range sets them

## Color by CDS

**Show → Show CDS reading frame colors**, in the linear genome view's hamburger
menu, tints each CDS segment by the frame it is read in, so one color is one
frame across the view. Frame is constant within a segment, so a color change
across a junction is a frame shift. The setting applies to every gene track in
the view, and JBrowse remembers it across sessions.

<Figure caption="Color by CDS on BRCA1. Top: the menu toggle. Bottom: each codon tinted by reading frame with its amino acid drawn over it." src="/img/gene_track_color_by_cds.png" />

## Color transcripts by a value in the file

The [`encoding.color`](/docs/config/featurecolor) object binds a field in the
GFF3 attribute column to a scale:

- **`ordinal`:** each value takes a distinct color
- **`threshold`:** a number takes the color of the interval it falls in, between
  the cut points `scale.domain` lists, with one `scale.range` color per interval
- **Parts:** a transcript's exons, CDS and UTRs take the transcript's value, and
  a UTR follows `encoding.color` unless `utrs.encoding.color` overrides it

- **JBrowse lowercases attribute names.** `dIF=0.79` reads under the key `dif`,
  so the field is `dif`
- **A transcript with no value paints grey**, keyed as `(no value)`. The
  tutorial below writes its effect size only on the transcripts its test called,
  so the rest stay grey

The key lists every interval and draws over the track, and you can dismiss it.
For a rule no scale expresses, `encoding.color` also takes a jexl expression as
its `value`; see the [jexl configuration guide](/docs/config_guides/jexl).

<Figure caption="ATP5F1C with muscle and liver RNA-seq coverage over GENCODE transcripts colored by satuRn's isoform-fraction change." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

The [differential transcript usage tutorial](/docs/tutorials/dtu) has the track
configuration behind that figure and the pipeline that writes the attributes.

## Peptide lettering

The track draws the translated protein on coding features by default. Zooming
in, the amino acids first appear as alternating per-codon shading, then at
roughly base-pair resolution as single-letter code over each codon, in register
with the reference sequence track. Turn off **Show amino acids when zoomed in**,
in the view menu's **Show** submenu, to keep the view from fetching the
reference.

The translation follows the transcript's strand and CDS phase, splitting codons
that straddle an exon boundary:

- **Genetic code:** a CDS with a `transl_table` attribute (NCBI convention, e.g.
  `transl_table=2` for vertebrate mitochondria) translates with that code
- **Start codon:** the first codon shows as `M` when it is a valid start for
  that table (including `GTG` or `TTG`)
- **Exceptions:** the track applies and highlights any `transl_except` override
  (e.g. selenocysteine `U`)

<Figure caption="GPX1 on hg19, its transl_except codon drawn as a highlighted U. The sequence track's six-frame translation above shows a stop there." src="/img/gene_track_selenocysteine.png" />

## Mature peptides (polyproteins)

Many viral genomes encode one polyprotein cleaved into mature peptides. When a
CDS has `mature_protein_region` (or `mature_protein_region_of_CDS`) subfeatures,
the track draws each cleavage product as a separate stacked row in a distinct
color, hoverable and clickable. A GenBank conversion's `mat_peptide` and
`sig_peptide` draw the same way, under the CDS or beside it under the gene.

The first row also draws the coding bases no product covers, in the CDS color:
the stop codon, or the rest of a CDS that names only its signal peptide.

- The track names each row by its `product` attribute, which NCBI writes in
  place of a Name, and falls back to the track's `labels.name`.
- **Subfeature labels** in the track menu sets the placement
  ([`labels.subfeatures`](/docs/config/featuresubfeaturelabels)). `Auto` names
  cleavage products only; `Off`, `Below` and `Overlay` apply to every part,
  transcripts included.

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
highlights the residue, and vice versa. The tutorial covers launch routes and
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
