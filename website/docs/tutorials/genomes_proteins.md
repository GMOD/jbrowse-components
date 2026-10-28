---
title: Proteins on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (proteins)
description:
  Type a gene into the protein browser and open its exons, its 3D structure and
  a protein alignment as one linked JBrowse session, then launch the same views
  from a gene's right-click menu
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

A missense variant changes one codon, and what it does depends on where that
residue sits in the folded protein and how conserved it is across related
proteins. The [protein browser](https://genomes.jbrowse.org/protein-browser/) on
genomes.jbrowse.org takes a gene symbol and opens the gene, its 3D structure and
an alignment of related proteins as one JBrowse session, linked so that a
residue picked in one view lights up in the other two. We'll:

- open _TP53_ in the protein browser on R248, a cancer hotspot, and read the
  session it launches
- change what the session opens on: a domain, a structure, a coloring
- launch the same views from a gene's right-click menu, where you choose the
  structure and the species to align, on _NLRP1_, whose domains differ between
  mammals

## Prerequisites

- for the right-click route in your own JBrowse, the protein3d and msaview
  plugins from the plugin store
  ([Adding the plugins to your own instance](#adding-the-plugins-to-your-own-instance));
  genomes.jbrowse.org already loads them

## The data

Nothing to download: the protein browser and the two plugins fetch from these
services, per gene, when you open a session. _Adding the plugins to your own
instance_ covers your own JBrowse.

<details>
<summary>The files</summary>

| What it is                                                                                                      | File                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AlphaFold DB, the predicted structures                                                                          | [alphafold.ebi.ac.uk](https://alphafold.ebi.ac.uk/)                                 |
| PDBe, the experimental structures                                                                               | [pdbe/](https://www.ebi.ac.uk/pdbe/)                                                |
| UniProt, the protein each gene encodes and the projected Domains, Chains, Mutations and AA Modifications tracks | [www.uniprot.org](https://www.uniprot.org/)                                         |
| InterPro, the protein browser's domain map and the Pfam seed alignments                                         | [interpro/](https://www.ebi.ac.uk/interpro/)                                        |
| PDBe-KB, the protein browser's partner and ligand lists                                                         | [pdbe-kb/](https://www.ebi.ac.uk/pdbe/pdbe-kb/)                                     |
| UniRef, the cluster a protein with no NCBI orthologs is aligned with                                            | [uniref](https://www.uniprot.org/help/uniref)                                       |
| NCBI's ortholog report, the rows of an ortholog alignment                                                       | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/) |
| NCBI's Conserved Domain Database, the alignment's domain overlay                                                | [cdd.shtml](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)                   |

</details>

## Opening TP53 in the protein browser

We'll start on _TP53_'s R248, one of the residues most often mutated in human
cancer, where the protein contacts DNA. Open the
[protein browser](https://genomes.jbrowse.org/protein-browser/) and click the
**TP53** chip, which focuses the page on that residue:

- The page draws the protein end to end with its InterPro domains, marks R248 on
  the ruler, and shows the focus beside the launch button as **Opens at Cancer
  hotspot R248**.
- Tick **Advanced**. The **Structure** box shows the entry the chip picked,
  3KMD, the DNA-binding core of p53 bound to DNA.
- Set **Color** to **AlphaMissense pathogenicity**, which paints each residue by
  how damaging AlphaMissense predicts a substitution there to be.
- Click **Open in JBrowse ↗**.

Typing a gene into the search box and pressing **Search** opens the same card
with no focus. Advanced also adds a species box, which takes any species name or
NCBI taxon ID whose genome genomes.jbrowse.org hosts with NCBI gene annotation,
and the chips after **TP53** open other organisms on a residue each, such as
rifampicin resistance in _M. tuberculosis_ _rpoB_.

<Figure caption="The protein browser on the TP53 chip with Advanced ticked: the picked structure and coloring above the launch button, and the protein map below." src="/img/protein/protein_browser_page.png" />

## Reading the TP53 session

Open in JBrowse opens a new tab with one session and three views of the same
transcript:

- **The gene**, its coding exons back to back with the introns cut out, read 5′
  to 3′, above ClinVar's variants and AlphaMissense's scores
- **The alignment**, the seed alignment of the Pfam family R248 falls in, P53,
  opened on the columns around R248 with _TP53_'s own row, linked to the gene,
  in the middle. The launch button's tooltip names the alignment before you
  click.
- **The structure**, 3KMD in [Mol\*](https://molstar.org/), with R248 selected

Hover a codon in the gene view and its residue lights up on the structure and
its column in the alignment; hover the structure or the alignment and the codon
lights up in turn. [g2p_mapper](https://github.com/cmdcolin/g2p_mapper) maps
each position through the transcript's coding sequence, so introns, UTRs and
residues the structure does not cover highlight nothing.

<Figure caption="TP53 as the protein browser launches it on R248: the coding exons over ClinVar and AlphaMissense, the P53 family alignment on R248's column, and 3KMD colored by AlphaMissense with R248 in magenta." src="/img/protein/protein_browser_tp53.png" />

## Changing what the TP53 session opens on

The page picks the session's alignment and structure from the focus beside the
launch button. Click **Clear** to drop it, and choose another:

- **A domain**: click a block on the map's Domains row. The session opens on the
  domain, with the seed alignment of its Pfam family.
- **A residue**: type a position into the **Residue** box, which Advanced shows
  while nothing is focused. The alignment becomes the Pfam seed of the domain
  the residue falls in, and the structure the PDB entry in which that residue
  was seen touching DNA, a small molecule or another protein, else the AlphaFold
  model.
- **A partner or a ligand**: under Advanced, click **Partners…** or **Ligands…**
  on the map to list the proteins and small molecules PDB entries show touching
  this one. Clicking one opens the complex they were seen in.
- **A truncation**: under a focused residue, **More about residue** offers to
  open on the residues a stop codon there, or skipping its exon, would remove.
- **Nothing**: the session opens on the whole gene, the AlphaFold model and an
  alignment of the gene's orthologs from NCBI, one per species, built in the
  browser when the session opens. NCBI lists orthologs for vertebrates and
  insects; any other protein gets its UniRef50 cluster instead.

**Structure** under Advanced overrides the pick with any AlphaFold or PDB entry,
and **Color** also offers ClinVar pathogenic variants and, on an AlphaFold
model, AlphaFold confidence (pLDDT). The page URL holds the gene, the focus and
the structure, so
[?gene=TP53&ref=9606&residue=248&structure=3kmd](https://genomes.jbrowse.org/protein-browser/?gene=TP53&ref=9606&residue=248&structure=3kmd)
reopens this launch.

## Launching from the gene's right-click menu

The protein browser picks the structure and the alignment for you. A gene's
right-click menu, in any JBrowse with the protein3d and msaview plugins, lets
you pick both, and starts from a gene already on screen.

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), type `TP53`
into the location box, and right-click the gene. The menu has **Launch protein
view** from protein3d and **Launch MSA view** from msaview. Choose **Launch
protein view**.

The dialog opens on its **AlphaFoldDB search** tab:

- **Look up from the feature's identifiers** (selected) maps the transcript's
  accession to UniProt entries and picks the reviewed one.
- **Choose transcript isoform** opens on the isoform you right-clicked, picks
  which transcript becomes the query, and tags the isoforms whose translation
  matches the structure's residues.
- **Launch** renders the structure.

<Video src="/media/proteins/genomes_protein_launch.mp4" caption="TP53's right-click launcher, the dialog resolving a UniProt entry and an isoform, and the structure Launch renders. Hovering a coding position picks out its residue." />

The structure opens under the genome view, linked the same way as the protein
browser's. Where its sequence differs from the transcript's translation, the
**Pairwise alignment** panel shows each residue the structure lacks as a gap,
and **Import manual alignment...** in the view menu takes a pairwise alignment
of your own in Clustal format instead. The lookup needs a gene feature with a
recognizable protein or transcript ID, which the hosted configs' RefSeq gene
tracks, **NCBI RefSeq - RefSeq All** and **NCBI RefSeq - RefSeq Curated**, have.

The protein view also has per-residue tracks for pLDDT, domains, helices and
hydrophobicity. **Open side by side**, at the foot of the list the arrow beside
the dialog's **Launch** button opens, puts the protein view beside the genome
view. Click the nuclear export signal on the alignment panel's **Motif** row to
select its residues and band their codons on the gene.

<Figure caption="A connected session on TP53, NCBI RefSeq above the AlphaFold structure. A motif clicked on the protein's feature track selects its residues and bands their codons." src="/img/protein/connected.png" />

### Other structure sources and views in the Launch dialog

The dialog's other tabs take a structure from elsewhere:

- **PDB search** lists the experimental structures PDBe maps to the protein's
  UniProt entry
- **Foldseek search** finds structures similar to the protein's
- **File or URL** takes a PDB or mmCIF file of yours

Click the arrow beside **Launch** to list everything the dialog can build.
**Launch 1D protein annotation view** opens a linear genome view whose genome is
the protein. The plugin registers the UniProt accession as a temporary assembly
with the amino-acid sequence as its reference, so coordinates are residues. The
view opens with these tracks on:

- **UniProt features**, a section per feature type
- **Antigen**
- **AlphaFold confidence** (pLDDT) and **AlphaMissense scores**
- **ClinVar**, the transcript's missense variants

<Figure src="/img/protein/annotation_1d.png" caption="TP53 above the 1D protein view its gene menu launched, with its tracks in residue coordinates." />

<Video src="/media/proteins/annotation_1d.mp4" caption="TP53's launch dialog opened on the arrow beside Launch, then the 1D annotation view." />

Launch an alignment from the same right-click menu too, and each panel's menu
has **Arrange all views → Side by side**, which puts the genome, alignment and
structure in three columns.

<Video src="/media/proteins/tiled_views.mp4" caption="TP53's gene menu launching an alignment and a structure, then Arrange all views → Side by side. One hover in the genome moves the highlight in both." />

## Choosing the species to align for NLRP1

**Launch MSA view** builds an alignment from the orthologs NCBI publishes for
most annotated genes, one per species, with the rows and the aligner yours to
choose. We'll use _NLRP1_, an inflammasome sensor whose domain architecture
varies between mammals. Type `NLRP1` into the location box, right-click the gene
and choose **Launch MSA view**. The dialog opens on its **Orthologs** tab:

- **Query species** is the species the gene came from, free text resolved
  against NCBI's taxonomy: a scientific name, a common name or a taxon id
- **Rows to align** is how many species to build. NCBI orders its ortholog
  report from the reference organisms outward, so this takes the closest N
- **Choose isoform** picks which transcript becomes the query row, the one the
  genome view stays linked to
- **MSA Algorithm** sets which aligner EBI runs, Clustal Omega by default
- **BLAST query**, a separate tab, takes a gene with no resolvable symbol

Press **Submit**. The alignment opens below the genome view, with a tree on the
left and NCBI's conserved domains drawn over the residues once NCBI returns
them. It opens at residue zoom on the N terminus; **View → Zoom → Fit width**
(View is the eye icon in the alignment's toolbar) puts the whole alignment on
screen, which is the zoom the domain blocks read at.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="NLRP1's right-click menu, the Launch MSA view dialog on its Orthologs tab, and the alignment Submit builds." />

### Reading NLRP1's conserved-domain overlay on the MSA

Each colored block is an NCBI conserved domain, drawn in alignment columns. The
pyrin (PYD) domain sits at the N terminus of human _NLRP1_ and is absent from
mouse _Nlrp1a_. NACHT, the winged helix, HD2, FIIND and CARD run across nearly
every row and are the control; the whale rows have only the C-terminal end.

The domain calls come from NCBI's protein records. For a protein NCBI has no
calls for:

- `react-msaview-cli interproscan` scans the sequences into a domain file.
- **File → Open annotation file...** reads that file in. The dialog's _How to
  make one_ link opens a
  [walkthrough](https://gmod.org/JBrowseMSA/tutorials/protein_family) that also
  covers `interpro`, the instant path when the rows are UniProt accessions.

### UniProt domains in genome coordinates for NLRP1

UCSC projects UniProt's annotations onto the genome, so the hosted config holds
them as tracks. Turn on **UniProt - Domains** (under Genes and Gene Predictions)
in the linear view you launched from, then narrow it to one record:

- **Filter by...** in the track menu applies the row `uniProtId` is `Q9C000`,
  the gene's reviewed UniProt entry. Without it, the track draws a domain once
  per isoform, and isoforms sharing exons overlap.
- **UniProt - Chains**, **Mutations** and **AA Modifications** project the rest
  of the record.

<Figure src="/img/genomes_msa/genomic_domains.png" caption="NLRP1 with NCBI RefSeq above UniProt - Domains, filtered to the gene's reviewed UniProt entry." />

## More protein browser sessions

A protein browser session takes any other JBrowse track beside the codon, and a
second protein view beside the first. Each figure's live link opens its
session.[^constructs]

Open a figure's live link and hover the highlighted codon in the genome view;
each protein view then lights the residue it codes for.

<Figure src="/img/protein/brca1_sge_alphamissense.png" caption="BRCA1 at codon 1775 with the saturation genome editing score of every missense change and the AlphaMissense score of every possible base change, above 1T15 twice: colored by the scan's residue mean on the left and by AlphaMissense on the right. The M1775R highlight names the residue in both structures." />

<Figure src="/img/protein/tp53_scan_alphamissense.png" caption="TP53 at codon 248 with the Funk 2025 CRISPR scan and AlphaMissense, above the p53 dimer on DNA (3KMD) colored by the scan's mean per codon on the left and by AlphaMissense on the right." />

<Figure src="/img/protein/tp53_y220c.png" caption="TP53 with every missense change of a CRISPR scan around codon 220, above the p53 surface at residue 220 in wild type (2XWR), Y220C (2J1X) and Y220C bound to rezatapopt (9S9O), all from one camera." />

<Figure src="/img/protein/brca1_m1775r_pocket.png" caption="BRCA1 with saturation genome editing scores and ClinVar records at codon 1775, above 1T15 with the BACH1 peptide and 1N5O, the M1775R crystal, with that peptide superposed from 1T15." />

<Figure src="/img/protein/snca_e46k.png" caption="SNCA codons 46 and 80 above one layer of the wild-type rod polymorph (6CU7) and the E46K (6UFR) α-synuclein fibrils, turned so Lys80 sits at the same place in both, with the distance between residues 46 and 80 drawn in the mutant." />

<Figure src="/img/protein/tp53_r273h.png" caption="TP53 with a saturation genome editing score track, the alignment's domains and two protein views: 5MG7 and 7B49, both bound to DNA. R273H is labelled in every view." />

<Figure src="/img/protein/kras_g12c.png" caption="KRAS at codon 12 with its single-base missense changes, above the KRAS surface at residue 12 in wild type (4OBE), G12C (4LDJ) and G12C bound to sotorasib (6OIM), all from one camera, with switch II colored." />

<Figure src="/img/protein/hbb_e6v.png" caption="HBB at the sickle codon with its two single-base changes, above wild-type hemoglobin (2HHB) and two sickle hemoglobin molecules (2HBS), both from one camera. The sickle codon and its residue are magenta, and Phe85 and Leu88 of the neighboring molecule are teal." />

<Figure src="/img/protein/ccr5_delta32.png" caption="CCR5 with the 1000 Genomes 30x reads of a Δ32/Δ32, a Δ32/+ and a +/+ sample over the 32-base deletion, above the codons the shifted frame reads, then CCR5 bound by HIV gp120, drawn green (6MEO), beside CCR5 alone, drawn only to the last residue the frameshift spares." />

<Figure src="/img/protein/ccr5_delta32_gene.png" caption="CCR5 on hg38 above the Δ32 allele as its own assembly, with the deletion drawn as the pinch between the two alignment blocks and the Δ32 coding sequence ending at its premature stop." />

<Figure src="/img/protein/ccr5_delta32_combo.png" caption="The same locus in one session: the three samples' reads over the deletion, CCR5 on hg38 above the Δ32 allele as its own assembly, and the receptor drawn whole beside the part the frameshift spares." />

<Figure src="/img/protein/apoe_e4.png" caption="APOE under a Manhattan plot of FinnGen Alzheimer's disease statistics, above the ortholog alignment and two protein views: the 1B68 crystal structure and its AlphaFold model colored by pLDDT." />

<Figure src="/img/protein/f5_leiden.png" caption="F5 under a Manhattan plot of FinnGen venous thromboembolism statistics, with the alignment and two protein views: factor Va alone (7KXY) and bound to activated protein C (9MOV)." />

<Figure src="/img/protein/braf_v600e.png" caption="BRAF with the activation loop and the ATP binding site as domain colors in the genome view, the alignment and 4MNF." />

<Figure src="/img/protein/cftr_f508.png" caption="CFTR with its ortholog alignment and 5UAK colored by ClinVar pathogenic variant count." />

## Adding the plugins to your own instance

The plugin store lists the two plugins as **Protein3d** and **MSAView**, and
[](/docs/user_guides/plugin_store) covers each way to install them.

The protein3d and msaview plugins add view types launched from a gene's
right-click menu in JBrowse Web and Desktop. The single-view embedded components
host only a linear genome view, so neither view type appears there.
[](/docs/jbrowser)'s `JBrowseRApp` takes both runtime plugins and a `views`
list, while [anywidget](/docs/jbrowse_anywidget)'s `JBrowseApp` has no plugin
loading yet.[^session]

The approach is described in
[_Proteins in the Genome Browser_](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/tp53_structures)
- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_domains)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [JBrowseMSA user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)
- [g2p_mapper](https://github.com/cmdcolin/g2p_mapper)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [UniProt](https://www.uniprot.org/)
- [InterPro](https://www.ebi.ac.uk/interpro/)
- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)

## Citations

- Broz and Dixit (2016).
  [Inflammasomes: mechanism of assembly, regulation and signalling](https://doi.org/10.1038/nri.2016.58)

[^constructs]:
    Some of these crystals carry engineered mutations. In the TP53 figure, 2J1X
    and 9S9O carry the stabilizing M133L, V203A, N239Y and N268D, none of them
    in the pocket. In the KRAS figure, 6OIM carries C51S, C80L and C118S, which
    remove the construct's other cysteines a covalent drug could react with.

[^session]:
    A `ProteinView` entry in a session-spec URL opens a connected view for demo
    links and embedded apps. The short form takes `uniprotId`, `transcriptId`
    and a `connectedView` with the `assembly`, `loc` and `tracks` to look the
    transcript up in; the plugin derives the AlphaFold structure and translates
    the transcript's CDS. The explicit form takes a structure `url`, feature and
    protein sequence, for a transcript no loaded track serves. A `ProteinView`
    with only a `url` opens as a standalone structure. The protein3d
    [launching guide](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/docs/launching.md#a-structure-connected-to-the-genome)
    has both forms.
