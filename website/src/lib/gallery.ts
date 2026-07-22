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
        label: 'Grape vs peach dotplot',
        spec: 'dotplot',
        guide: 'user_guides/dotplot_view',
        description:
          'Grape vs peach genome alignment as a dotplot, from a minimap2 PAF.',
      },
      {
        label: 'Grape vs peach - synteny view',
        spec: 'linear_synteny_gallery',
        guide: 'tutorials/synteny_visualization',
        description:
          'Grape vs peach MCScan synteny: fine per-gene links riding on top of the larger blocks, red where collinear and blue where inverted.',
      },
      {
        label: 'Human vs mouse synteny',
        spec: 'hs1_vs_mm39_synteny',
        guide: 'tutorials/synteny_visualization',
        description:
          'Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny from liftOver chains. Auto-diagonalized and colored by query chromosome, turning a dense hairball into a readable map of conserved blocks.',
      },
      {
        label: 'Grape vs peach vs cacao - synteny view',
        spec: 'multiway_synteny/grape_peach_cacao',
        guide: 'tutorials/multiway_synteny',
        description:
          'Three plant genomes stacked in one synteny view, MCScan blocks connecting each adjacent pair. Auto-diagonalized and colored by the shared anchor genome.',
      },
      {
        label: 'E. coli 4-strain all vs all PAF',
        spec: 'multiway_synteny/ecoli_pangenome',
        guide: 'tutorials/allvsall_synteny',
        description: 'Four E. coli strain all-vs-all alignment',
      },
    ],
  },
  {
    id: 'sv',
    title: 'Structural variants',
    items: [
      {
        label: 'SV inspector (SKBR3)',
        spec: 'sv_inspector_importform_loaded',
        guide: 'user_guides/sv_inspector_view',
        description:
          'Inter-chromosomal translocations in the SKBR3 cell line: a sortable table alongside a whole-genome circular overview.',
      },
      {
        label: 'Breakpoint split view',
        spec: 'breakpoint_split_view',
        guide: 'user_guides/sv_visualization',
        description:
          'An SKBR3 translocation in the breakpoint split view, connecting supporting reads (black curves) and the variant call (green, with feet showing directionality).',
      },
      {
        label: '1000 Genomes SVs (chr19 inversion)',
        spec: 'multisv',
        guide: 'tutorials/sv_multisamples',
        description:
          'A large chr19 inversion in the 1000 Genomes SV VCF, found with the in-app clustering workflow.',
      },
      {
        label: 'Inversion (single-row view)',
        session:
          '?config=test_data%2Fconfig_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
      },
      {
        label: 'Inversion (linked reads)',
        session:
          '?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR',
      },
    ],
  },
  {
    id: 'alignments',
    title: 'Alignments, long reads, and base modifications',
    items: [
      {
        label: 'Small deletion (haplotype-sorted)',
        spec: 'smalldel',
        guide: 'user_guides/alignments_track',
        description:
          'A heterozygous small deletion in GIAB nanopore reads, colored and grouped by HP (haplotype) tag — the deletion sits on one haplotype only.',
      },
      {
        label: 'Insertion (multi-platform reads)',
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
          'RNA-seq over ACTB: a coverage histogram, strand-colored splice-junction arcs, the spliced read pileup, and the gene model below.',
      },
      {
        label: 'Fiber-seq 6mA (GAPDH)',
        spec: 'gallery/fiberseq_gapdh',
        guide: 'tutorials/methylation',
        description:
          'ONT single-molecule fiber-seq over the GAPDH promoter, each read colored per-base by its 6mA (A+a) calls; single-cell ATAC above corroborates the open promoter. Data: nanopore HG002 fiber-seq and CATlas single-cell ATAC.',
      },
      {
        label: 'Nanopore methylation coloring',
        spec: 'gallery/nanopore_methylation',
        guide: 'tutorials/methylation',
        description:
          'Human nanopore reads over a chr20 CpG island, each read colored per-CpG by its 5mC modification call — methylated cytosines red, unmethylated blue — so the hypomethylated island core stands out from the methylated flanks. Data: Oxford Nanopore Technologies (jbrowse.org/genomes/GRCh38/methylation/human_chr20_mod_call_5mC_5hmC_CG.cram).',
      },
      {
        label: 'Bisulfite methylation (Arabidopsis)',
        spec: 'methylation/arabidopsis_wgbs_contexts',
        guide: 'tutorials/bisulfite',
        description:
          'Arabidopsis WGBS colored per read by the bisulfite C→T signal (no MM/ML tags), shown with aggregate CpG/CHG/CHH methylation and gene annotation. CpG marks the gene body, while all three plant contexts mark the silenced element.',
      },
    ],
  },
  {
    id: 'variants',
    title: 'Variants and populations',
    items: [
      {
        label: '1000 Genomes trio',
        spec: 'multi-sv-trio',
        guide: 'tutorials/sv_multisamples',
        description:
          'Coverage for a 1000 Genomes trio — mother, child, and father — beneath the ensemble structural-variant VCF.',
      },
      {
        label: 'Trio phased VCF matrix',
        img: 'trio-matrix-phased-clean.png',
        guide: 'tutorials/analyze_trio',
        description:
          'A phased trio genotype matrix: child, mother, and father each as two haplotype rows, so matching blocks reveal which parental haplotype the child inherited.',
      },
      {
        label: 'GWAS LD coloring (FTO locus)',
        spec: 'gallery/gwas_bmi_fto',
        guide: 'user_guides/gwas_track',
        description:
          'A Manhattan plot with LocusZoom-style LD coloring around the FTO obesity locus.',
      },
      {
        label: 'More GWAS examples (Storybook) ↗',
        href: 'https://jbrowse.org/storybook/lgv/locus-zoom-ld',
      },
    ],
  },
  {
    id: 'copynumber',
    title: 'Coverage and copy number',
    items: [
      {
        label: 'CNV track (COLO829 tumor/normal)',
        spec: 'cnv',
        guide: 'user_guides/multiquantitative_track',
        description:
          'Whole-genome COLO829 melanoma coverage, tumor and normal on one multi-quantitative track (mosdepth BigWigs).',
      },
      {
        label: 'Clustered copy-number (1000 Genomes)',
        spec: 'gallery/copynumber_clustered',
        guide: 'user_guides/multiquantitative_track',
        description:
          'Copy-number profiles for many 1000 Genomes individuals as a multi-row density heatmap. The in-app "Cluster by score" workflow reorders rows by signal similarity.',
      },
    ],
  },
  {
    id: 'hic',
    title: 'Hi-C contact maps',
    items: [
      {
        label: 'Hi-C contact matrix',
        spec: 'hic_track',
        guide: 'user_guides/hic_track',
        description:
          'A Hi-C contact matrix from a .hic file (Juicebox format) over ~11 Mb of chr8, with the RefSeq gene track above.',
      },
    ],
  },
  {
    id: 'epigenomics',
    title: 'Epigenomics and chromatin state',
    items: [
      {
        label: 'ChromHMM state painting',
        spec: 'chromhmm',
        guide: 'tutorials/chromhmm',
        description:
          'Dense chromatin-state annotations from Roadmap Epigenomics (127 epigenomes) in the multi-row feature display.',
      },
      {
        label: 'Single-cell ATAC (INS locus)',
        spec: 'gallery/scatac_catlas',
        guide: 'tutorials/scatac_pseudobulk',
        description:
          'Single-cell ATAC accessibility by cell type around the INS locus, one coverage row per cell type. Data: CATlas (Zhang et al. 2021).',
      },
    ],
  },
  {
    id: 'genes',
    title: 'Genes, proteins, and compact genomes',
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
          'The linear genome view flipped to read right-to-left (3′→5′), useful for anti-sense genes.',
      },
      {
        label: 'Collapsed introns (PTEN)',
        spec: 'gene_track_collapse_introns',
        guide: 'user_guides/gene_track',
        // No `session` override: the spec's own session is the pre-collapse
        // view, which is exactly where a reader needs to land to right-click
        // PTEN and run the collapse the figure walks through.
        description:
          "PTEN's introns collapsed so the nine exons sit side by side, with the NA12878 direct-RNA sashimi arcs then spanning adjacent exons. Right-click the gene in the live view to run it yourself.",
      },
      {
        label: 'SARS-CoV-2 polyprotein (ORF1ab)',
        spec: 'gallery/sarscov2_polyprotein',
        guide: 'user_guides/gene_track',
        description:
          'The SARS-CoV-2 ORF1ab polyprotein colored by CDS frame and cleaved into its mature peptides.',
      },
      {
        label: 'GPX1 selenoprotein (UGA→Sec)',
        spec: 'gene_track_selenocysteine',
        guide: 'user_guides/feature_sequence',
        description:
          'GPX1\'s in-frame UGA is recoded as selenocysteine. With amino-acid lettering on, that codon shows as a "U" on orange instead of a stop.',
      },
    ],
  },
  {
    id: 'instances',
    title: 'Full example instances and hubs',
    items: [
      {
        label: 'Human demo instance',
        session:
          '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
        demoOnly: true,
      },
      {
        label: 'UCSC GenArk hub import',
        session:
          '?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none',
        demoOnly: true,
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
    label: '2025 Biocuration workshop w/ Apollo 3',
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
    label: '2023 publication figures (Genome Biology)',
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
