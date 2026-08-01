import { specSessionUrls } from './galleryLinks.generated.ts'

// Single source of truth for the /gallery/ page: a screenshot + description
// card for every item that has an `img`, and a compact link for the rest.
// Hyperlinks build from CODE_BASE + `session`, so pointing all cards at a
// different deploy (e.g. a release build instead of a branch preview) is a
// one-line edit.

// The hosted app build these sessions open in. Change only this to retarget
// every live link on the page.
export const CODE_BASE = 'https://jbrowse.org/code/jb2/main/'

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
      {
        label: 'Whole-genome dotplot',
        spec: 'dotplot',
        guide: 'user_guides/dotplot_view',
        description:
          'Grape against peach from a minimap2 PAF, colored by query chromosome with short alignments filtered out. The dotplot pans and zooms like any other view, and drag-selecting a block opens that region as a linear synteny view.',
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
        guide: 'tutorials/multiway_synteny',
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
        guide: 'tutorials/sv_multisamples',
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
        // The mutation matrix, not the copy-number painting the "Coverage"
        // section already carries for this cohort: different assay, different
        // display, and the grouping is what the picture is about.
        label: 'TCGA mutations by histology',
        spec: 'tcga/mutations_cdh1_histology',
        guide: 'tutorials/tcga_cohort_mutations',
        description:
          'Somatic mutations in CDH1 across a TCGA breast cohort, one column per mutation and one row per tumor, with the rows grouped by histology. The truncating mutations fall almost entirely in the lobular band.',
      },
      {
        label: 'Dog10K wolfdog ancestry',
        spec: 'dog10k-wolfdog-ancestry',
        guide: 'tutorials/local_ancestry',
        description:
          'Dog10K haplotypes painted by FLARE against gray wolf and breed-dog panels, two rows per animal: wolf blocks tile the wolfdog breeds and are absent from the German Shepherds.',
      },
      {
        label: 'Dog10K Collie eye deletion',
        spec: 'dog10k-nhej1-cea-deletion',
        guide: 'tutorials/dog10k_svs',
        description:
          'A 7.8 kb deletion in an NHEJ1 intron genotyped across dog breeds from the Dog10K structural-variant callset: carried by Collies and relatives, absent from other breeds and from wolves.',
      },
      {
        label: 'Dog10K body size haplotype',
        spec: 'dog10k-igf1-haplotype',
        guide: 'tutorials/dog10k_selection',
        description:
          'Dog10K SNVs across IGF1 for whole toy and giant breeds, clustered by genotype, with size class as the sidebar swatch.',
      },
      {
        label: 'Dog10K CYP1A2 nonsense allele',
        spec: 'dog10k-cyp1a2-nonsense',
        guide: 'tutorials/dog10k_lof',
        description:
          'A stop-gained variant in a drug-metabolizing P450, genotyped across dog breeds: carried and often homozygous in several breeds, absent from every wolf and coyote in the Dog10K collection.',
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
      {
        label: 'LD triangle at the lactase locus',
        spec: 'ld/lct_lactase',
        guide: 'tutorials/linkage_disequilibrium',
        description:
          'Haplotypic r² from phased 1000 Genomes genotypes, with a red block of high linkage in the middle and lower values to either side.',
      },
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
          'Roadmap Epigenomics chromatin states from a single BigBed. The multi-row feature display splits features by cell type into one row each, colors them with the itemRgb values the file carries, and derives the state legend from the data.',
      },
      {
        label: 'Single-cell ATAC pseudobulk',
        spec: 'gallery/scatac_catlas',
        guide: 'tutorials/scatac_pseudobulk',
        description:
          'CATlas single-cell ATAC pseudobulk around the INS locus: cell-type BigWigs gathered into one multi-quantitative track, one labeled row each on a shared scale, rather than separate tracks to line up by hand.',
      },
      {
        label: 'Single-cell RNA pseudobulk',
        spec: 'scrna/ms4a1_bcell',
        guide: 'tutorials/scrna_pseudobulk',
        description:
          'A 10x PBMC experiment pooled by cell type into one coverage BigWig each and loaded as a single track. At a B-cell marker only the B row carries the pile, and it sits at the 3’ end of the gene, where 3’ chemistry puts the reads.',
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
        label: 'Genome linked to a 3D structure',
        spec: 'protein/connected',
        guide: 'tutorials/protein_structure',
        description:
          'TP53 with RefSeq models and ClinVar variants beside its AlphaFold structure, connected through the genome-to-structure alignment. Hovering a variant in the genome highlights the residue it hits on the structure.',
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
        label: 'HPRC structural alleles by haplotype',
        spec: 'hprc2/mhc_clustered',
        guide: 'tutorials/pangenome_hprc',
        description:
          'Structural alleles across the HPRC release 2 haplotypes, one row each, clustered by genotype under the HLA class II genes they fall in. Haplotypes sharing whole sets of insertions and deletions form solid blocks, with no HLA typing involved.',
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
    id: 'conservation',
    title: 'Conservation',
    items: [
      {
        label: 'phyloP conservation',
        spec: 'phylop_ncbi_refseq_tp53',
        guide: 'user_guides/quantitative_track',
        description:
          'The UCSC phyloP conservation score over TP53 as a quantitative track above the NCBI RefSeq gene model, its per-base peaks lining up with the coding exons.',
      },
    ],
  },
  {
    id: 'hubs',
    title: 'Track hubs',
    items: [
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
