import { CODE_BASE } from './code-base.ts'
import { specSessionUrls } from './galleryLinks.generated.ts'

// Single source of truth for the /gallery/ page: a screenshot + description
// card for every item that has an `img`, and a compact link for the rest.
// Hyperlinks build from CODE_BASE + `session`, so the whole page retargets with
// the rest of the site's live links.
//
// CODE_BASE is src/lib/code-base.ts's, not a second copy of the same string.
// It was one, which meant `JBROWSE_CODE_BASE` — documented there as retargeting
// every live link at once, and set by deploy_staging.sh — moved the doc figures
// and left all ~45 gallery cards pointing at `main/`.

export interface GalleryItem {
  label: string
  // Name of the screenshot spec (scripts/screenshot-specs.ts) whose figure this
  // item shows. Both the card image (`<spec>.png`) and the live link are derived
  // from that one spec, so the figure and the "open live" link can never drift —
  // see website/CLAUDE.md. Prefer this over a hand-written `session`.
  spec?: string
  // Query string starting with '?', appended to CODE_BASE to form the live URL.
  // Used for items with no screenshot spec, or to override a spec's link when
  // the spec's base capture isn't the state to open live (e.g. a flip demo whose
  // figure flips at capture time).
  session?: string
  // Absolute external URL (e.g. a Storybook example). For link-only items that
  // point outside the app; wins over every other destination.
  href?: string
  // Path under /docs (no base prefix) for items whose best destination is a
  // written walkthrough rather than a live session.
  guide?: string
  // Path under /img (no base prefix), for items whose figure isn't spec-derived.
  // Normally omit this and set `spec` instead; the image path is then `<spec>.png`.
  img?: string
  description?: string
}

export interface GallerySection {
  id: string
  title: string
  items: GalleryItem[]
}

// Path under /img for an item's figure: an explicit `img`, else `<spec>.png`.
// Items with neither have no figure and render as a compact link, not a card.
export function itemImg(item: GalleryItem) {
  return item.img ?? (item.spec ? `${item.spec}.png` : undefined)
}

// The live app (or external) destination for an item: an external `href` wins,
// then a `session` override (set precisely to point somewhere other than the
// spec default), then the spec-derived live session; `undefined` when the item
// has no live view at all. Ignores `guide` — that is a separate destination the
// card offers alongside this one (see `itemLinks`).
export function itemLiveHref(item: GalleryItem) {
  if (item.href) {
    return item.href
  }
  if (item.session) {
    return CODE_BASE + item.session
  }
  if (item.spec) {
    const url = specSessionUrls[item.spec]
    if (!url) {
      throw new Error(
        `gallery item "${item.label}" references unknown screenshot spec "${item.spec}" — run \`pnpm gen:gallery-links\` after editing screenshot-specs.ts`,
      )
    }
    // always a relative `?config=…&session=…` query — a spec's url is what the
    // generator opened against the local build, never an absolute URL. An
    // absolute destination is what `href` is for.
    return CODE_BASE + url
  }
  return undefined
}

// Whether an item's backing doc is a tutorial or a user guide — the two pages
// word the link differently ("Read the tutorial ↗" vs a bare "tutorial"), but
// the tutorials/ vs guide distinction is shared, so it lives here.
export function itemGuideKind(item: GalleryItem) {
  return item.guide?.startsWith('tutorials/') ? 'tutorial' : 'guide'
}

// Link text, exported so the pages can't word the same destination differently.
export const LIVE_LABEL = 'Open in JBrowse ↗'

export function itemGuideLabel(item: GalleryItem) {
  return `Read the ${itemGuideKind(item)} ↗`
}

// Docs URL for the tutorial / user guide backing an item, if it names one.
// `baseUrl` is the site base (e.g. /jb2) so the link resolves under the deploy.
export function itemGuideHref(item: GalleryItem, baseUrl: string) {
  if (!item.guide) {
    return undefined
  }
  const [path, hash] = item.guide.split('#')
  return `${baseUrl}/docs/${path}/${hash ? `#${hash}` : ''}`
}

export interface GalleryLink {
  href: string
  label: string
}

// Every destination an item offers, in the order it shows them. The written
// walkthrough leads: someone who picked a card off a contact sheet wants the
// page that says how the picture was made, and the live session is the click
// beside it rather than one hidden behind the image. Items with no backing doc
// (a hub URL, an external Storybook page) show the live link alone.
export function itemLinks(item: GalleryItem, baseUrl: string): GalleryLink[] {
  const guide = itemGuideHref(item, baseUrl)
  const live = itemLiveHref(item)
  return [
    ...(guide ? [{ href: guide, label: itemGuideLabel(item) }] : []),
    ...(live ? [{ href: live, label: LIVE_LABEL }] : []),
  ]
}

// The destination an item leads with. An item that names none of `guide`,
// `href`, `session` or `spec` has nowhere to send a reader, which is an
// authoring mistake rather than a state to render — throw, like itemLiveHref.
export function itemPrimary(item: GalleryItem, baseUrl: string): GalleryLink {
  const first = itemLinks(item, baseUrl)[0]
  if (!first) {
    throw new Error(`gallery item "${item.label}" has no destination`)
  }
  return first
}

export const gallerySections: readonly GallerySection[] = [
  {
    id: 'synteny',
    title: 'Synteny and whole-genome comparison',
    items: [
      // Yeast, not the grape/peach plot this card used to carry. Those two are
      // divergent enough that the PAF is all sub-kilobase hits, so every block
      // draws as one dot and the card was a field of specks: a dotplot whose
      // diagonal does not survive teaches a reader nothing about dotplots.
      // R64 against YJM1447 is one unbroken diagonal with a single visible jog,
      // which is what the view is for and is legible at card size. The
      // grape/peach plot keeps its place in the dotplot guide, in the section
      // about cutting clutter on a busy plot, where being unreadable is the
      // point being made.
      {
        label: 'Whole-genome dotplot',
        spec: 'gallery/yeast_dotplot',
        guide: 'user_guides/dotplot_view',
        description:
          'Two yeast assemblies from a minimap2 PAF: a single diagonal running corner to corner where the two agree, stepping off it once where they do not. The dotplot pans and zooms like any other view, and drag-selecting a block opens that region as a linear synteny view.',
      },
      {
        label: 'Human vs mouse synteny',
        spec: 'hs1_vs_mm39_synteny',
        guide: 'tutorials/synteny_visualization',
        description:
          'Whole-genome liftOver chains between human (hs1) and mouse (mm39), auto-diagonalized so one genome reorders to match the other, and colored by query chromosome to follow where each one lands.',
      },
      {
        label: 'hg38 vs CHM13 liftOver alignment',
        spec: 'synteny_hg38_hs1_tnnt3',
        guide: 'tutorials/genomes_synteny',
        description:
          'The UCSC chain at TNNT3, colored by strand. The one reverse-strand block is a segment the two assemblies place on opposite sides of the gene, the rearrangement from Fig 5C of the T2T human variation paper.',
      },
      {
        label: 'Multi-way synteny',
        spec: 'multiway_synteny/grape_peach_cacao',
        guide: 'tutorials/multiway_synteny_grape_peach_cacao',
        description:
          'Grape, peach, and cacao stacked in one synteny view from MCScan gene pairs, one track per adjacent pair of genomes, auto-diagonalized and colored by the genome shared between both tracks.',
      },
    ],
  },
  {
    id: 'sv',
    title: 'Structural variants',
    items: [
      {
        label: 'SV inspector',
        spec: 'sv_inspector_importform_loaded',
        guide: 'user_guides/sv_inspector_view',
        description:
          'SKBR3 translocations in a sortable, filterable table beside a circular whole-genome overview that mirrors the table filters. A row dropdown or an arc click opens a breakpoint split view on that call.',
      },
      {
        label: 'Breakpoint split view',
        spec: 'breakpoint_split_view',
        guide: 'user_guides/sv_visualization',
        description:
          'An SKBR3 translocation with each side in its own panel and the connections drawn across them: supporting reads as black curves, the variant call in green with feet showing directionality.',
      },
      {
        label: '1000 Genomes SV genotypes',
        spec: 'multisv',
        // the guide that embeds this figure. The SV-multisamples tutorial is
        // the same display on a different call (RHD, where the reads settle the
        // genotypes), so it is not where this card's picture lives.
        guide: 'user_guides/multivariant_track',
        description:
          'One row per sample straight from a multi-sample VCF, colored by genotype. Carriers of a large inversion appear as a solid block across the 1000 Genomes SV callset.',
      },
      {
        label: 'Pair orientation coloring',
        spec: 'gallery/inverted_duplication',
        guide: 'user_guides/sv_visualization',
        description:
          'Read pairs colored by orientation and joined to their mates by arcs. Green LL, navy RR, and magenta split reads mark the inverted segment of this 1000 Genomes INVdup call, clustered at the breakpoints of an otherwise grey concordant pileup.',
      },
      {
        label: 'Tumor/normal translocation evidence',
        spec: 'sv_cgiab/translocation_breakpoint_split',
        guide: 'tutorials/sv_visualization_cgiab',
        description:
          'A C-GIAB cancer benchmark translocation between two chromosomes, one per panel. Black splines connect tumor PacBio HiFi reads that map partway to each side, the read-level evidence for the call.',
      },
      // The card above answers the same question from reads; this one answers it
      // from contact frequency, which is a different capability rather than the
      // same view on new data — the matrix is fetched for every PAIR of
      // displayed regions, so two chromosomes in one view is the whole method.
      {
        label: 'K562 translocation in Hi-C',
        spec: 'hic/bcr_abl1_translocation',
        guide: 'tutorials/hic_structural_variants',
        description:
          'ENCODE Hi-C for a leukaemia line and a normal-karyotype line, each with a chr9 window and a chr22 window open at once. The wedge between the two panels is chr9 against chr22: empty in the normal cell, a solid block in K562, where the two chromosomes are fused.',
      },
      {
        label: 'Read cloud',
        spec: 'alignments/read_cloud',
        guide: 'user_guides/sv_visualization',
        description:
          'Each mate pair and split-read chain collapses to one mark placed by its insert size, so short-insert pairs sit above the concordant baseline instead of hiding in the pileup below. Marks are colored by insert size and orientation together.',
      },
    ],
  },
  {
    id: 'alignments',
    title: 'Alignments, long reads, and base modifications',
    items: [
      {
        label: 'Group reads by tag',
        spec: 'smalldel',
        guide: 'user_guides/alignments_track',
        description:
          'GIAB nanopore reads colored and grouped by HP tag, which splits the pileup into a labeled block per tag value. The deletion falls in one block only. Grouping works off any BAM tag, not just HP.',
      },
      {
        label: 'Insertion across platforms',
        spec: 'insertion',
        guide: 'user_guides/alignments_track',
        description:
          'The same GIAB insertion in Nanopore, PacBio, and Illumina reads. Soft clipping on the Illumina reads marks the boundaries the long reads span.',
      },
      {
        label: 'RNA-seq splice junctions',
        spec: 'rnaseq/basic',
        guide: 'tutorials/rnaseq',
        description:
          'RNA-seq over ACTB: coverage histogram, strand-colored junction arcs, the spliced read pileup, and the gene model below. The arcs come from the N skips in the BAM, so there is no separate junction file to load.',
      },
      {
        label: 'Fiber-seq base modifications',
        spec: 'gallery/fiberseq_gapdh',
        guide: 'user_guides/alignments_track',
        description:
          'ONT fiber-seq over the GAPDH promoter, each read colored base by base from its MM/ML modification tags (6mA), with single-cell ATAC above. The coloring is per read, so modifications stay at single-molecule resolution instead of collapsing into an aggregate track.',
      },
      {
        label: 'Nanopore methylation coloring',
        spec: 'gallery/nanopore_methylation',
        guide: 'tutorials/methylation',
        description:
          'Human nanopore reads over a CpG island: red CpGs where the 5mC call is methylated, blue where it is not. The calls come straight from the CRAM modification tags, with no bedMethyl track involved.',
      },
      {
        label: 'Bisulfite read coloring',
        spec: 'methylation/arabidopsis_wgbs_contexts',
        guide: 'tutorials/bisulfite',
        description:
          'Arabidopsis WGBS colored per read from its C→T conversions against the reference rather than from MM/ML tags, with aggregate CpG/CHG/CHH tracks and the gene annotation alongside.',
      },
    ],
  },
  {
    id: 'variants',
    title: 'Variants and populations',
    items: [
      {
        label: '1000 Genomes trio SV coverage',
        spec: 'multi-sv-trio',
        // sv_visualization.md, not the SV tutorial: that page refocused onto
        // the chr19 inversion and this figure went back to the guide that
        // documents reading trio alignments against an SV call.
        guide: 'user_guides/sv_visualization',
        description:
          'Coverage for a 1000 Genomes trio (mother, child, father) beneath the ensemble structural-variant VCF.',
      },
      {
        label: '1000 Genomes phased trio matrix',
        spec: 'trio-matrix-phased-clean',
        guide: 'tutorials/analyze_trio',
        description:
          'A phased trio genotype matrix: child, mother, and father each as two haplotype rows, so matching blocks reveal which parental haplotype the child inherited.',
      },
      {
        // One Dog10K card, not four: the single-variant figures (CYP1A2
        // nonsense, the NHEJ1 deletion, the FLARE painting) are a thin band of
        // genotypes in a mostly empty frame, which doesn't read at card size.
        //
        // The scan rather than the IGF1 genotype matrix that held this slot. The
        // matrix "looks cool but is not a very clear message" (review) and can't
        // be made into one: the toy/giant contrast there is a frequency shift
        // rather than a fixed difference, so it is speckle whichever way the rows
        // are ordered. The scan states the same result in a shape.
        label: 'Dog10K body size scan',
        spec: 'dog10k-size-fst-scan-genome',
        guide: 'tutorials/dog10k_selection',
        description:
          'Fst between toy/small and giant dog breeds in 200 kb windows across all 38 autosomes. The differentiated windows sit on known body-size genes, labeled on the figure.',
      },
      {
        label: 'GWAS with LD coloring',
        spec: 'gwas/locuszoom_ld',
        guide: 'user_guides/gwas_track',
        description:
          'An SLE GWAS at the STAT4 locus, with points shaded by r² to the lead SNP from a PLINK .ld file beside the summary statistics.',
      },
      {
        label: 'More GWAS examples (Storybook) ↗',
        href: 'https://jbrowse.org/storybook/lgv/locus-zoom-ld',
        description:
          'The same LD-colored Manhattan track inside an embedded React linear genome view, with its source alongside.',
      },
      // The LD card was ld/lct_pooled_vs_panel and is REMOVED, on the same bar
      // that retired ld/anopheles_r2_vs_dprime: two shaded triangles mean
      // nothing to a reader who does not already know what r² is, and a gallery
      // card is the one place with no surrounding prose to lean on. The figure
      // is still in tutorials/ld_human.md, where it has that prose. No
      // replacement LD card on purpose — padding a section beats nothing only
      // if the replacement reads, and none of the LD figures do at card size.
      {
        label: 'BXD QTL with haplotype painting',
        spec: 'qtl/bxd_tyrp1_locus',
        guide: 'tutorials/bxd_qtl',
        description:
          'A BXD mouse coat-color QTL scan with the strain haplotype painting below it. Sorting the rows by genotype at the peak over Tyrp1 separates the mixed block into B (red) above D (blue), directly under the Manhattan peak.',
      },
      {
        label: 'Drosophila inversion Fst',
        spec: 'popgen/fst_in2lt_2L',
        guide: 'tutorials/population_genomics',
        description:
          'Every Drosophila dm6 chromosome arm at once, with the In(2L)t inversion extent on top and Fst between inverted and standard lines below it. Fst is elevated across the whole inverted arm and low elsewhere.',
      },
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage, copy number, and epigenomics',
    items: [
      {
        label: 'Tumor/normal copy number',
        spec: 'cnv',
        guide: 'user_guides/multiquantitative_track',
        description:
          'COLO829 tumor and normal mosdepth BigWigs as one multi-quantitative track in scatter rendering, sharing an autoscaled y-axis, with every main chromosome open at once.',
      },
      {
        // Kept alongside the TCGA cohort card below rather than merged into it:
        // one megabase against that card's whole genome, and a different
        // dataset. Same display, different picture.
        label: '1000 Genomes copy number',
        spec: 'gallery/copynumber_clustered',
        guide: 'tutorials/population_cnv',
        description:
          'Copy number over one megabase, one row per 1000 Genomes individual. "Cluster rows by score" in the track menu reorders the rows on the window in view, so matching rows stack together.',
      },
      {
        label: 'TCGA-BRCA cohort copy number',
        spec: 'tcga/cohort_cnv_genome',
        guide: 'tutorials/tcga_cohort_cnv',
        description:
          'Copy number across every primary tumor in the cohort, one row per tumor, clustered by profile. Blue is loss and red is gain on the log2 ratio, so recurrent events appear as vertical stripes through the stack.',
      },
      {
        label: 'ChromHMM chromatin states',
        spec: 'chromhmm',
        guide: 'tutorials/chromhmm',
        description:
          'Roadmap Epigenomics chromatin states from a single BigBed. The multi-row feature display splits features by cell type into one row each, colors them with the itemRgb values the file carries, and derives the state legend from the data. Clustered over the HOXA cluster, the 127 epigenomes separate into those that open its anterior half and those holding all of it repressed.',
      },
      {
        label: 'Single cells under their pseudobulk',
        spec: 'scrna/percell_lyz',
        guide: 'tutorials/scrna_pseudobulk',
        description:
          'Nine pseudobulk coverage rows from a 10x PBMC experiment, above the 4390 cells they sum over, read one row per cell from a cells-by-bins Zarr matrix. At LYZ the monocyte block is solid and the lymphocyte rows are ambient speckle, one UMI per cell.',
      },
      {
        label: 'Hi-C contact matrix',
        spec: 'hic_track',
        guide: 'user_guides/hic_track',
        description:
          'A Hi-C contact matrix with the RefSeq gene track above. JBrowse reads the .hic file in place over HTTP range requests and picks the binning resolution from the zoom level. The track menu steps that resolution and sets the color ramp.',
      },
    ],
  },
  {
    id: 'genes',
    title: 'Genes and proteins',
    items: [
      {
        label: 'Horizontally flipped view',
        // `horizontally_flip` (the compose parent, for the stacked card image)
        // has no url of its own; open the flipped half directly since that's the
        // state the figure teaches.
        spec: 'horizontally_flip',
        session: specSessionUrls.horizontally_flip_after,
        description:
          'The whole view mirrored so coordinates run right to left and the reverse-strand ACTB runs in its own 5′→3′ direction. Reads, sequence, and annotations flip with it, and the location box records the state as a [rev] locstring.',
      },
      {
        label: 'Collapsed introns',
        spec: 'gene_track_collapse_introns',
        guide: 'user_guides/gene_track',
        // No `session` override: the spec's own session is the pre-collapse
        // view, which is exactly where a reader needs to land to right-click
        // PTEN and run the collapse the figure walks through.
        description:
          "PTEN's introns collapsed so its exons sit side by side, with the NA12878 direct-RNA sashimi arcs spanning adjacent exons. Right-click the gene in the live view to run it yourself.",
      },
      {
        label: 'SARS-CoV-2 polyprotein subfeatures',
        spec: 'gallery/sarscov2_polyprotein',
        guide: 'user_guides/gene_track',
        description:
          'The SARS-CoV-2 ORF1ab polyprotein with CDS-frame coloring and subfeature labels on, so each mature_protein_region in the GFF is drawn and named on its own instead of collapsing into one CDS block.',
      },
      {
        label: 'Selenocysteine translation',
        spec: 'gene_track_selenocysteine',
        // gene_track, not feature_sequence: this is the track's per-codon
        // lettering (where the figure itself lives), not the sequence panel in
        // the feature-details popup.
        guide: 'user_guides/gene_track',
        description:
          "Per-codon amino-acid lettering on GPX1, where the in-frame UGA shows as selenocysteine on orange rather than a stop. Translation follows the annotation's exception instead of a fixed codon table.",
      },
      {
        label: 'Differential transcript usage',
        spec: 'dtu/dtu_colored_gene_glyph',
        guide: 'tutorials/dtu',
        description:
          'ATP5F1C with ENCODE muscle and liver RNA-seq coverage over GENCODE transcripts colored by the change in isoform fraction satuRn measured between the two tissues. The boxed exon has no muscle reads and a liver peak, and only the liver-preferred transcript draws an exon there.',
      },
      {
        label: 'Genome linked to a 3D structure',
        spec: 'protein/connected',
        guide: 'tutorials/genomes_proteins',
        description:
          'TP53 with RefSeq models and ClinVar variants beside its AlphaFold structure, connected through the genome-to-structure alignment. Hovering a variant in the genome highlights the residue it hits on the structure.',
      },
      {
        // pyrin_residues, not the tutorial's three-frame click-path figure: a
        // stack fits inside 1200x600 as a sliver, and this is the same view
        // anyway, left at the zoom it opens on. Its spec is also the one that
        // builds the alignment from a session spec rather than by driving the
        // dialog, so the card's live link opens the alignment directly.
        label: 'Cross-species protein alignment',
        spec: 'genomes_msa/pyrin_residues',
        guide: 'tutorials/genomes_proteins',
        description:
          "NLRP1 aligned across the species NCBI has an ortholog gene for, built from the gene symbol rather than from an alignment file, with NCBI's conserved-domain calls drawn in alignment columns. The pyrin domain is called on the human, chimpanzee, gorilla and marmoset rows.",
      },
    ],
  },
  {
    id: 'pangenome',
    title: 'Pangenomes',
    items: [
      // Dataset first, then the pipeline that built what the card shows. The
      // three E. coli cards are the same five strains through three pipelines,
      // so the pipeline is the only thing that distinguishes them and it belongs
      // in the label rather than only in the prose.
      {
        label: 'HPRC pangenome locus as a graph',
        spec: 'pangenome/hprc_c4_subgraph',
        guide: 'tutorials/pangenome_hprc',
        description:
          'The C4 locus of the HPRC release 2 pangenome as a force-directed graph, above lanes of the same window on GRCh38. Both panels are colored by reference position, so the thread winding through the graph runs red to magenta with the segment blocks above it.',
      },
      {
        // The HPRC card that held this slot was hprc2/mhc_clustered, deleted in
        // review. Its replacement is the figure that already carried the same
        // clustered 464-haplotype matrix, next to the graph the alleles came
        // out of, which is a picture no other card in this section shows.
        label: 'HPRC graph beside its callset',
        spec: 'pangenome/hprc_graph_vs_callset',
        guide: 'tutorials/pangenome_hprc',
        description:
          'One deletion site in the HPRC release 2 MHC, marked in a linear view over all 464 haplotypes clustered by genotype, with an arrow from the band to the reference node it removes in the force-directed graph below.',
      },
      {
        // One card for the pggb tutorial, not two, and the presence/absence
        // projection is the one it keeps: the genotype matrix that held this
        // slot was retired in review ("kind of boring screenshot"), and it was
        // also the same dense blue matrix the Minigraph-Cactus tutorial drew of
        // the same strains. Presence/absence is a picture no other card in this
        // section shows.
        label: 'E. coli pangenome (pggb)',
        spec: 'pangenome/pav',
        guide: 'tutorials/pangenome_ecoli',
        description:
          'A pggb pangenome graph projected onto the K12 reference as per-strain presence, one row per non-reference strain across the whole chromosome, dropping to zero over the stretches that strain does not carry.',
      },
      {
        // Third pick for this card. The halSynteny stack was a five-row ribbon
        // band indistinguishable from the all-vs-all card below it; the HAL MAF
        // that replaced it is a 6 kb window of alignment rows, which reads as
        // nothing at card size. This one is the graph's own odgi viz picture
        // rebuilt from the same data on a genome coordinate — the raster's row
        // order and colors, so the two are comparable, which no other card here
        // does. Both earlier figures are still in the tutorial.
        label: 'E. coli pangenome (Minigraph-Cactus)',
        spec: 'pangenome_cactus/graph_correspondence',
        guide: 'tutorials/pangenome_cactus',
        description:
          "Per-strain presence in the Minigraph-Cactus graph, one row per strain in the colors odgi viz gives them, drawn on K12's coordinates instead of the graph's node order. White is sequence that strain does not carry.",
      },
      {
        // A plain five-row ecoli_pangenome stack used to have a card of its own.
        // It is the same dataset and the same stack as this card, which
        // additionally shows the one-vs-all lanes, and stacking N genomes is
        // already the multi-way MCScan card in the synteny section.
        label: 'E. coli all-vs-all alignment (minimap2)',
        spec: 'multiway_synteny/ecoli_one_vs_all_whole_genome',
        guide: 'tutorials/allvsall_synteny',
        description:
          'One all-vs-all PAF read twice on the same axis: as one-vs-all lanes in an ordinary linear view (K-12 against every other strain, grouped per strain) and as the ribbon bands of the stack below. Inversions are blue in both.',
      },
    ],
  },
  {
    // Was two one-card sections, `conservation` and `hubs`. They are the same
    // capability seen twice: UCSC's catalog reached with no config written, once
    // through the hosted per-genome configs and once through a hub.txt. The
    // phyloP card only read as its own subject while its figure was built from
    // session tracks; now that it comes from the hosted hg38 config, filing it
    // under Conservation named the dataset rather than what the card shows.
    //
    // Keeps the `hubs` id: /gallery/#hubs is linked from hub_url.md and
    // connections.md, and check-links would fail on a rename.
    id: 'hubs',
    title: 'Hosted genomes and track hubs',
    items: [
      {
        label: 'phyloP conservation',
        spec: 'genomes_basics/phylop_tp53',
        guide: 'tutorials/genomes_basics',
        description:
          'The UCSC phyloP conservation score over TP53 as a quantitative track under the NCBI RefSeq gene model, its per-base peaks lining up with the coding exons. Both tracks come from the hosted hg38 config on genomes.jbrowse.org, opened from the track selector with no display settings changed.',
      },
      {
        label: 'UCSC GenArk hub import',
        session:
          '?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none',
        description:
          'A UCSC track hub opened from a hubURL parameter alone, no JBrowse config: the assembly and its tracks all come from hub.txt.',
      },
    ],
  },
]
