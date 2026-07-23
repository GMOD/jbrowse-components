import { specSessionUrls } from './galleryLinks.generated.ts'

// Single source of truth for the /gallery/ and /demos/ pages. The gallery page
// renders the screenshot + description for every item that has an `img`; the
// demos page renders every item as a compact live link. Both build their
// hyperlinks from CODE_BASE + `session`, so pointing all demos at a different
// deploy (e.g. a release build instead of a branch preview) is a one-line edit.

// The hosted app build these sessions open in. Change only this to retarget
// every live link on both pages.
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
  // Entry points / hubs that are useful to link from the demos page but aren't
  // visualization highlights worth featuring in the gallery. These are excluded
  // from the gallery page and shown only on the demos page.
  demoOnly?: boolean
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

// The live app (or external) destination for an item: a `session` override
// wins (set precisely to point somewhere other than the spec default), then an
// external `href`, then the spec-derived live session. Ignores `guide` — the
// backing tutorial is surfaced as its own "read more" link on the card rather
// than as the primary destination.
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
    return url.startsWith('http') ? url : CODE_BASE + url
  }
  return ''
}

// Whether an item's backing doc is a tutorial or a user guide — the two pages
// word the link differently ("Read the tutorial ↗" vs a bare "tutorial"), but
// the tutorials/ vs guide distinction is shared, so it lives here.
export function itemGuideKind(item: GalleryItem) {
  return item.guide?.startsWith('tutorials/') ? 'tutorial' : 'guide'
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

// Single best destination for an item (used by the demos page's compact link
// list): the live session if there is one, otherwise the backing guide.
export function itemHref(item: GalleryItem, baseUrl: string) {
  return itemLiveHref(item) || itemGuideHref(item, baseUrl) || ''
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
          'A whole-genome minimap2 PAF (grape vs peach) as a live dotplot: it pans and zooms like any other view, and drag-selecting a block opens that region as a linear synteny view.',
      },
      {
        label: 'Synteny blocks and gene anchors',
        spec: 'linear_synteny_gallery',
        guide: 'tutorials/synteny_visualization',
        description:
          'Grape vs peach MCScan synteny at two levels at once: the coarse blocks, with the fine per-gene anchor links drawn on top of them, red for collinear and blue for inverted.',
      },
      {
        label: 'Human vs mouse synteny',
        spec: 'hs1_vs_mm39_synteny',
        guide: 'tutorials/synteny_visualization',
        description:
          'Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny from liftOver chains, auto-diagonalized so the chromosomes of one genome are reordered to match the other, and colored by query chromosome to follow where each one lands.',
      },
      {
        label: 'Synteny colored by strand',
        spec: 'synteny_hg38_hs1_tnnt3',
        guide: 'tutorials/genomes_synteny',
        description:
          'The UCSC hg38 to T2T-CHM13 liftOver chain at TNNT3, colored by strand: the one reverse-strand block is the 22 kb segment that GRCh38 places upstream of the gene and T2T-CHM13 places on the other side of it, the rearrangement from Fig 5C of the T2T human variation paper.',
      },
      {
        label: 'Multi-way synteny (MCScan blocks)',
        spec: 'multiway_synteny/grape_peach_cacao',
        guide: 'tutorials/multiway_synteny',
        description:
          'Three genomes (grape, peach, cacao) stacked in one synteny view, connected by MCScan anchors, one track per adjacent pair, auto-diagonalized and colored by the genome shared between both pairs.',
      },
      {
        label: 'Multi-way synteny (all-vs-all PAF)',
        spec: 'multiway_synteny/ecoli_pangenome',
        guide: 'tutorials/allvsall_synteny',
        description:
          'Four E. coli strains in one synteny view, every band backed by the same all-vs-all PAF. The view takes any number of assemblies, and a minimum alignment length filter drops the short alignments so the backbone stays readable.',
      },
      {
        label: 'Same-species dotplot',
        spec: 'gallery/hg19_vs_hg38',
        guide: 'user_guides/dotplot_view',
        description:
          'A same-species whole-genome dotplot of the hg19→hg38 liftOver chain: homologous chromosomes line up 1:1 down the diagonal, and the off-diagonal specks are the segments the two human assemblies place differently. Both chrom.sizes and the chain load straight from UCSC.',
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
          'SKBR3 translocations in the SV inspector: a sortable, filterable table beside a whole-genome circular overview that mirrors the table filters. A row dropdown or an arc click opens a breakpoint split view on that call.',
      },
      {
        label: 'Breakpoint split view',
        spec: 'breakpoint_split_view',
        guide: 'user_guides/sv_visualization',
        description:
          'An SKBR3 translocation with each side of the rearrangement in its own panel and the connections drawn across them: supporting reads as black curves, the variant call in green with feet showing directionality.',
      },
      {
        label: 'Multi-sample SV genotypes',
        spec: 'multisv',
        guide: 'tutorials/sv_multisamples',
        description:
          'The multi-sample variant display draws one row per sample straight from a multi-sample VCF — 3,202 rows here — over a 5 Mb window, colored by genotype. Carriers of a large chr19 inversion read as a solid block in the 1000 Genomes SV callset.',
      },
      {
        label: 'Read pair and split-read connections',
        session:
          '?config=test_data%2Fconfig_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
        description:
          'Curves drawn between the two ends of paired-end reads and between the pieces of a split long read, across PacBio, Illumina 2x250, and ONT ultra-long tracks at an HG002 inversion. Both breakends fall in the same window, so the connections stay in one row instead of spanning two linked panels.',
      },
      {
        label: 'Pair orientation coloring',
        spec: 'inverted_duplication',
        guide: 'user_guides/sv_visualization',
        description:
          'Read pairs colored by orientation and joined to their mates by arcs: teal RL pairs point away from each other over the duplicated copy, green LL and dark blue RR pairs run in the same direction over the inverted one. They are a minority of an otherwise grey concordant pileup, so they cluster at the breakpoints of this 1000 Genomes INVdup call.',
      },
      {
        label: 'Tumor/normal split view',
        spec: 'sv_cgiab/translocation_breakpoint_split',
        guide: 'tutorials/sv_visualization_cgiab',
        description:
          'A C-GIAB cancer benchmark translocation between chr3 and chr13 in a breakpoint split view: black splines connect tumor PacBio HiFi reads that map partway to each chromosome, the read-level evidence for the fusion the SV caller reported.',
      },
      {
        label: 'Read cloud mode',
        // Rebuilt as a session spec: the old share link saved the pre-4.4
        // LinearReadCloudDisplay, whose settings no longer survive the unified
        // LinearAlignmentsDisplay migration, so it opened as a plain pileup.
        // Its ONT-UL track is dropped — 52MB over this window, past the
        // region-size gate, so the link sat on a "too much data" banner (or a
        // minute of downloading with forceLoad) instead of showing the cloud.
        session:
          '?config=test_data/config_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr1:197,745,000-197,767,000","tracks":[{"trackId":"pacbio_hg002","type":"LinearAlignmentsDisplay","readConnections":"cloud","height":260},{"trackId":"illumina_hg002","type":"LinearAlignmentsDisplay","readConnections":"cloud","readConnectionsHeight":120,"height":320}]}]}',
        description:
          'The same locus in cloud mode, where each mate pair and split-read chain collapses to one mark placed by its insert size, so anomalously spaced or oriented pairs sit apart from the normal ones. PacBio and Illumina 2x250 above their pileups.',
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
          'GIAB nanopore reads colored and grouped by HP tag, which splits the pileup into a labeled block per tag value — the deletion falls in one block only. Grouping works off any BAM tag, not just HP.',
      },
      {
        label: 'Insertion across platforms',
        spec: 'insertion',
        guide: 'user_guides/alignments_track',
        description:
          'A ~1.5kb GIAB insertion across Nanopore, PacBio, and Illumina reads. Soft clipping on the Illumina reads marks the insertion boundaries the long reads span.',
      },
      {
        label: 'RNA-seq splice junctions',
        img: 'rnaseq/basic.png',
        guide: 'tutorials/rnaseq',
        description:
          'RNA-seq over ACTB: coverage histogram, strand-colored splice-junction arcs, the spliced read pileup, and the gene model below. JBrowse derives the arcs from the N skips in the BAM, so there is no separate junction file to load.',
      },
      {
        label: 'Fiber-seq base modifications',
        spec: 'gallery/fiberseq_gapdh',
        guide: 'tutorials/methylation',
        description:
          'ONT fiber-seq over the GAPDH promoter, each read colored base by base from its MM/ML modification tags (6mA, A+a), with single-cell ATAC above. The coloring is per read, so modifications stay at single-molecule resolution instead of collapsing into an aggregate track.',
      },
      {
        label: 'Nanopore methylation coloring',
        spec: 'gallery/nanopore_methylation',
        guide: 'tutorials/methylation',
        description:
          'Human nanopore reads over a chr20 CpG island in methylation coloring mode: red CpGs where the 5mC call is methylated, blue where it is not. The calls come straight from the CRAM modification tags, with no bedMethyl track involved.',
      },
      {
        label: 'Bisulfite read coloring',
        spec: 'methylation/arabidopsis_wgbs_contexts',
        guide: 'tutorials/bisulfite',
        description:
          'Arabidopsis WGBS in bisulfite mode, which colors each read from its C→T conversions against the reference rather than from MM/ML tags, so bisulfite data renders per read. Aggregate CpG/CHG/CHH tracks and the gene annotation alongside.',
      },
    ],
  },
  {
    id: 'variants',
    title: 'Variants and populations',
    items: [
      {
        label: 'Trio coverage and SV calls',
        spec: 'multi-sv-trio',
        guide: 'tutorials/sv_multisamples',
        description:
          'Coverage for a 1000 Genomes trio — mother, child, and father — beneath the ensemble structural-variant VCF.',
      },
      {
        label: 'Phased genotype matrix',
        img: 'trio-matrix-phased-clean.png',
        guide: 'tutorials/analyze_trio',
        description:
          'A phased trio genotype matrix: child, mother, and father each as two haplotype rows, so matching blocks reveal which parental haplotype the child inherited.',
      },
      {
        label: 'GWAS with LD coloring',
        spec: 'gallery/gwas_bmi_fto',
        guide: 'user_guides/gwas_track',
        description:
          'A GIANT BMI Manhattan plot at the FTO locus with LocusZoom-style LD coloring: points shade by r² to an index SNP, read from a PLINK .ld file beside the summary statistics. JBrowse takes the highest-scoring loaded SNP as the index, and a right-click re-anchors it to any other point.',
      },
      {
        label: 'More GWAS examples (Storybook) ↗',
        href: 'https://jbrowse.org/storybook/lgv/locus-zoom-ld',
        description:
          'The same LD-colored Manhattan track inside an embedded React linear genome view, with its source alongside.',
      },
      {
        label: 'LD triangle',
        spec: 'ld/lct_lactase',
        guide: 'tutorials/linkage_disequilibrium',
        description:
          'Haplotypic r² from phased 1000 Genomes genotypes drawn as an LD triangle at the human lactase locus, with a red block of high linkage under rs4988235 — the -13910 C>T variant behind lactase persistence — fading into paler flanks on both sides.',
      },
      {
        label: 'QTL scan with haplotype painting',
        spec: 'qtl/bxd_tyrp1_locus',
        guide: 'tutorials/bxd_qtl',
        description:
          'A BXD mouse coat-color QTL scan over chr4 with the 198-strain haplotype painting below it: sorting the rows by genotype at the peak over Tyrp1 resolves the salt-and-pepper block into a clean B (red) over D (blue) split directly under the Manhattan peak the scan is scoring.',
      },
      {
        label: 'Population genomics (Fst, π)',
        spec: 'popgen/fst_in2lt_2L',
        guide: 'tutorials/population_genomics',
        description:
          'All six Drosophila dm6 arms at once: the In(2L)t inversion extent on top, Fst between inverted and standard lines in the middle — a tall block across the whole left arm of chr2 against low background elsewhere — and whole-panel nucleotide diversity (π) below.',
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
          'COLO829 tumor and normal mosdepth BigWigs as one multi-quantitative track in scatter rendering, sharing an autoscaled y-axis. The view holds every main chromosome at once, so genome-wide copy number fits on one screen.',
      },
      {
        label: 'Clustered copy-number heatmap',
        spec: 'gallery/copynumber_clustered',
        guide: 'user_guides/multiquantitative_track',
        description:
          'Copy-number profiles for many 1000 Genomes individuals as a multi-row density heatmap, reordered by the track menu\'s "Cluster rows by score", which groups rows by signal similarity without leaving the browser.',
      },
      {
        label: 'Cohort copy number (1104 tumors)',
        spec: 'tcga/cohort_cnv_genome',
        guide: 'tutorials/tcga_cohort_cnv',
        description:
          'TCGA-BRCA copy number across all 1104 primary tumors, one 1px row per tumor and clustered by profile: blue is loss, red is gain on the log2 ratio. Recurrent events read as vertical stripes through the stack, and the heavily aneuploid tumors cluster together into red/blue rows.',
      },
      {
        label: 'ChromHMM state painting',
        spec: 'chromhmm',
        guide: 'tutorials/chromhmm',
        description:
          'Roadmap Epigenomics chromatin states for 127 epigenomes, drawn from a single BigBed: the multi-row feature display partitions features on a field (cell type) into one row each and colors them from itemRgb through a jexl callback.',
      },
      {
        label: 'Single-cell ATAC pseudobulk',
        spec: 'gallery/scatac_catlas',
        guide: 'tutorials/scatac_pseudobulk',
        description:
          'CATlas single-cell ATAC pseudobulk around the INS locus: 16 cell-type BigWigs gathered into one multi-quantitative track, one labeled row each on a shared scale, rather than 16 separate tracks to line up by hand.',
      },
      {
        label: 'Hi-C contact matrix',
        spec: 'hic_track',
        guide: 'user_guides/hic_track',
        description:
          'A Hi-C contact matrix over ~11 Mb of chr8 with the RefSeq gene track above. JBrowse reads the .hic file in place over HTTP range requests and picks the binning resolution from the zoom level; the track menu steps that resolution and sets the color ramp.',
      },
    ],
  },
  {
    id: 'genes',
    title: 'Genes and proteins',
    items: [
      {
        label: 'Horizontally flipped view',
        spec: 'horizontally_flip',
        // the spec's base capture is the un-flipped top frame (the figure flips
        // via a capture-time menu action); open the flipped end-state directly
        // with a [rev] locstring so the live view shows what the figure teaches
        session:
          '?config=test_data/config_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5,562,000-5,575,000[rev]","tracks":[{"trackId":"ncbi_gff_hg19","displaySnapshot":{"type":"LinearBasicDisplay","geneGlyphMode":"longestCoding"}}]}]}',
        description:
          'The whole view mirrored so coordinates run right-to-left and a reverse-strand gene (here ACTB) reads left-to-right in its own 5′→3′ direction. Reads, sequence, and annotations flip with it, and the location box records the state as a [rev] locstring.',
      },
      {
        label: 'Collapsed intron mode',
        spec: 'gene_track_collapse_introns',
        guide: 'user_guides/gene_track',
        // No `session` override: the spec's own session is the pre-collapse
        // view, which is exactly where a reader needs to land to right-click
        // PTEN and run the collapse the figure walks through.
        description:
          "PTEN's introns collapsed so the nine exons sit side by side, with the NA12878 direct-RNA sashimi arcs then spanning adjacent exons. Right-click the gene in the live view to run it yourself.",
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
        guide: 'user_guides/feature_sequence',
        description:
          "Per-codon amino-acid lettering on GPX1, where the in-frame UGA shows as U49 on orange rather than a stop: translation follows the annotation's selenocysteine exception instead of a fixed codon table.",
      },
      {
        label: 'Linked protein structure view',
        spec: 'protein/connected',
        guide: 'tutorials/protein_structure',
        description:
          'A connected genome↔protein session on TP53: the genome view with RefSeq models and ClinVar variants beside the AlphaFold structure, wired through the genome-to-structure alignment. Hovering a variant in the genome highlights the residue it hits on the 3D structure.',
      },
    ],
  },
  {
    id: 'pangenome',
    title: 'Pangenome graphs',
    items: [
      {
        label: 'Graph variant matrix',
        spec: 'pangenome/variant_matrix',
        guide: 'tutorials/pangenome',
        description:
          "A four-strain E. coli pangenome graph projected onto the K12 reference: the graph's variants as a multi-sample matrix, one column per called variant and one row per other strain, with the MAF alignment stacked below and the K12 gene lane above.",
      },
      {
        label: 'Presence/absence by strain (PAV)',
        spec: 'pangenome/pav',
        guide: 'tutorials/pangenome',
        description:
          'odgi presence/absence across K12 windows, one row per non-K12 strain: each row holds near 1 where the strain is present and drops to 0 over its own accessory sequence, so a single dip in aggregate graph depth resolves into which strain accounts for it.',
      },
      {
        label: 'Cactus pangenome synteny',
        spec: 'pangenome_cactus/synteny',
        guide: 'tutorials/pangenome_cactus',
        description:
          'A Minigraph-Cactus human pangenome rendered as synteny between haplotypes, the graph alignment re-plotted on genome coordinates so shared backbone and rearrangements read against the gene track rather than in abstract graph-node order.',
      },
    ],
  },
  {
    id: 'conservation',
    title: 'Multiple alignment and conservation',
    items: [
      {
        label: 'phyloP conservation',
        spec: 'phylop_ncbi_refseq_tp53',
        guide: 'user_guides/quantitative_track',
        description:
          'The UCSC 100-way phyloP conservation score over TP53 as a quantitative track above the NCBI RefSeq gene model, the per-base conservation peaks lining up with the coding exons.',
      },
    ],
  },
  {
    id: 'instances',
    title: 'Track hubs',
    items: [
      {
        label: 'UCSC GenArk hub import',
        session:
          '?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none',
        demoOnly: true,
        description:
          'A UCSC track hub opened from a hubURL parameter alone, no JBrowse config: the assembly and its tracks all come from hub.txt.',
      },
    ],
  },
]

export interface ExternalLink {
  label: string
  href: string
}

// Workshop, conference, and publication material. External links, not app
// sessions, so they live outside gallerySections.
export const guidedDemos: readonly ExternalLink[] = [
  {
    label: '2025 Biocuration workshop',
    href: 'https://github.com/GMOD/2025-biocuration-tutorial',
  },
  {
    label: '2025 PAG Workshop',
    href: 'http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2025',
  },
  {
    label: '2024 PAG Workshop',
    href: 'http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2024',
  },
  {
    label: '2023 ISMB/BOSC lightning talk',
    href: 'https://docs.google.com/presentation/d/18vdbamIwaCQUVagMD65EILQ35v7p79sJBZr6D0WiX9c/edit?usp=sharing',
  },
  {
    label: '2023 PAG workshop',
    href: 'http://gmod.org/wiki/JBrowse2_Tutorial_PAG_2023',
  },
  {
    label: '2023 publication figures',
    href: 'https://jbrowse.org/demos/paper2022/',
  },
  {
    label: '2022 Plant and Animal Genomes',
    href: 'https://jbrowse.org/demos/pag2022/',
  },
  {
    label: '2021 Biology of Genomes',
    href: 'https://jbrowse.org/demos/bog2021/',
  },
  {
    label: '2020 Cancer SVs guided demo',
    href: 'https://jbrowse.org/demos/cancer-demo-2020/',
  },
  { label: '2020 ASHG', href: 'https://jbrowse.org/demos/ashg2020/' },
  { label: '2020 ITCR', href: 'https://jbrowse.org/demos/itcr2020/' },
  {
    label: '2020 Biology of Genomes',
    href: 'https://jbrowse.org/demos/bog2020/',
  },
]
