import { specSessionUrls } from './galleryLinks.generated.ts'

// Single source of truth for the /gallery/ and /demos/ pages. The gallery page
// renders the screenshot + description for every item that has an `img`; the
// demos page renders every item as a compact live link. Both build their
// hyperlinks from CODE_BASE + `session`, so pointing all demos at a different
// deploy (e.g. a release build instead of a branch preview) is a one-line edit.

// The hosted app build these sessions open in. Change only this to retarget
// every live link on both pages.
export const CODE_BASE = 'https://jbrowse.org/code/jb2/webgl-poc/'

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

// Destination for an item. A `session` override wins (it's set precisely to
// point somewhere other than the spec/guide default); then a docs `guide`; then
// the spec-derived live session. `baseUrl` is the site base (e.g. /jb2) so guide
// links resolve under the deployed path.
export function itemHref(item: GalleryItem, baseUrl: string) {
  if (item.session) {
    return CODE_BASE + item.session
  }
  if (item.guide) {
    return `${baseUrl}/docs/${item.guide}/`
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

export const gallerySections: readonly GallerySection[] = [
  {
    id: 'synteny',
    title: 'Synteny and whole-genome comparison',
    items: [
      {
        label: 'Dotplot (grape vs peach)',
        spec: 'dotplot',
        description:
          'Grape vs peach genome alignment as a dotplot, from a minimap2 PAF.',
      },
      {
        label: 'Linear synteny (grape vs peach)',
        spec: 'linear_synteny_gallery',
        description:
          'Grape vs peach MCScan synteny: per-gene connections plus the larger synteny blocks, drawn as red (non-inverted) and blue (inverted) blocks on each genome.',
      },
      {
        label: 'Whole-genome synteny (human hs1 vs mouse mm39)',
        spec: 'hs1_vs_mm39_synteny',
        description:
          'Whole-genome human (hs1/T2T-CHM13) vs mouse (mm39) synteny from liftOver chains. Auto-diagonalized and colored by query chromosome, turning a dense hairball into a readable map of conserved blocks.',
      },
      {
        label: 'Grape / peach / cacao 3-way synteny (MCScan blocks)',
        spec: 'multiway_synteny/grape_peach_cacao',
        description:
          'Three plant genomes stacked in one synteny view, MCScan blocks connecting each adjacent pair. Auto-diagonalized and colored by the shared anchor genome.',
      },
      {
        label: 'E. coli 4-strain pangenome (all-vs-all PAF)',
        spec: 'multiway_synteny/ecoli_pangenome',
        description:
          'Four E. coli strains as a stacked pangenome, with one all-vs-all PAF track backing every band.',
      },
      {
        label: 'Yeast dotplot',
        spec: 'gallery/yeast_dotplot',
        description:
          'Whole-genome dotplot of two yeast strains (R64 vs YJM1447): the diagonal traces collinear sequence, off-diagonal dots mark rearrangements.',
      },
      {
        label: 'hg19 vs hg38 liftover',
        session: '?config=test_data%2Fhg19_vs_hg38%2Fconfig.json',
      },
    ],
  },
  {
    id: 'sv',
    title: 'Structural variants',
    items: [
      {
        label: 'SV inspector (SKBR3 translocations)',
        spec: 'sv_inspector_importform_loaded',
        description:
          'Inter-chromosomal translocations in the SKBR3 cell line: a sortable table alongside a whole-genome circular overview.',
      },
      {
        label: 'Breakpoint split view (SKBR3 translocation)',
        spec: 'breakpoint_split_view',
        description:
          'An SKBR3 translocation in the breakpoint split view, connecting supporting reads (black curves) and the variant call (green, with feet showing directionality).',
      },
      {
        label: '1000 genomes structural variants (chr19 inversion)',
        spec: 'multisv',
        description:
          'A large chr19 inversion in the 1000 Genomes SV VCF, found with the in-app clustering workflow.',
      },
      {
        label: 'Read vs reference insertion (SKBR3 PacBio)',
        spec: 'read_vs_ref_insertion',
        description:
          'A ~500bp insertion in SKBR3 PacBio reads. "Read vs reference" opens the alignment as a synteny view (lower panel) where the diagonal gap marks the insertion; drag to extract any read\'s sequence.',
      },
      {
        label: 'Breakpoint split view (multi-hop split read)',
        session:
          '?config=test_data%2Fbreakpoint%2Fconfig.json&session=share-xeUuLRakik&password=vh0ca',
        description:
          'A breakpoint split view connecting one split read across more than two locations.',
      },
      {
        label: 'Inversion ("single row" breakpoint view)',
        session:
          '?config=test_data%2Fconfig_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
      },
      {
        label: 'Inversion (linked reads mode)',
        session:
          '?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR',
      },
    ],
  },
  {
    id: 'alignments',
    title: 'Alignments and long reads',
    items: [
      {
        label: 'Heterozygous small deletion (GIAB, haplotype-sorted)',
        spec: 'smalldel',
        description:
          'A heterozygous small deletion in GIAB nanopore reads, colored and grouped by HP (haplotype) tag — the deletion sits on one haplotype only.',
      },
      {
        label: 'Insertion with multi-platform reads (GIAB)',
        spec: 'insertion',
        description:
          'A ~1.5kb GIAB insertion across Nanopore, PacBio, and Illumina reads. Soft clipping on the Illumina reads marks the insertion boundaries the long reads span.',
      },
      {
        label: 'Paired-end stranded RNA-seq',
        spec: 'gallery/rnaseq_paired',
        description:
          'Paired-end stranded RNA-seq: strand-colored coverage and reads with splice-junction arcs.',
      },
      {
        label: 'Fiber-seq single-molecule methylation (MAGEL2)',
        spec: 'gallery/fiberseq_magel2',
        description:
          'Fiber-seq single-molecule m6A footprints across MAGEL2, each read colored per-base by modification.',
      },
      {
        label: 'Direct RNA-seq nanopore modifications (BRCA1)',
        spec: 'gallery/directrna_brca1',
        description:
          'Nanopore direct-RNA reads over BRCA1 with per-base modification calls.',
      },
    ],
  },
  {
    id: 'methylation',
    title: 'Methylation and base modifications',
    items: [
      {
        label: 'Nanopore methylation / modifications coloring',
        spec: 'gallery/nanopore_methylation',
        description:
          'Human nanopore reads colored by base-modification (methylation) calls over a chr20 CpG island.',
      },
      {
        label: 'COLO829 tumor nanopore methylation',
        spec: 'methylation/colo829_cram_and_bedmethyl',
        description:
          'A CpG island in the COLO829 tumor line: per-base 5mC calls on the nanopore reads, over an aggregated bedMethyl density track.',
      },
      {
        label: 'Arabidopsis methylation (ONT 5mC/5hmC)',
        session: '?config=test_data%2Farabidopsis_methylation%2Fconfig.json',
      },
      {
        label: 'Arabidopsis methylation (EM-seq bisulfite)',
        session:
          '?config=test_data%2Farabidopsis_methylation%2Fconfig_emseq_bisulfite.json',
      },
    ],
  },
  {
    id: 'variants',
    title: 'Variants and populations',
    items: [
      {
        label: '1000 genomes extended trio',
        spec: 'gallery/1000g_trio',
        description:
          'A 1000 Genomes trio (mother, child, father) coverage beneath the ensemble structural-variant VCF.',
      },
      {
        label: 'Tetraploid potato multi-sample VCF',
        session: '?config=%2Fgenomes%2Fpotato%2Fconfig.json',
      },
      {
        label: 'Human trio phased VCF rendering',
        spec: 'gallery/human_trio_phased',
        description: 'Phased trio VCF calls from a KHV trio on chr1.',
      },
      {
        label: 'HG002 diploid assembly (dipcall hap1 + hap2 vs GRCh38)',
        spec: 'gallery/hg002_dipcall',
        description:
          'HG002 dipcall diploid assembly: hap1 and hap2 aligned to GRCh38 under the combined variant calls.',
      },
      {
        label: 'GWAS LocusZoom-style LD coloring (GIANT BMI, FTO locus)',
        session: '?config=test_data%2Fgwas%2Flocuszoom_ld.json',
        description:
          'A Manhattan plot with LocusZoom-style LD coloring around the FTO obesity locus.',
      },
      {
        label: 'GWAS LocusZoom-style LD coloring (SLE, STAT4 locus)',
        spec: 'gallery/gwas_sle_stat4',
        description:
          'An SLE GWAS Manhattan plot with LocusZoom-style LD coloring around the STAT4 locus.',
      },
    ],
  },
  {
    id: 'quantitative',
    title: 'Coverage, copy number, and epigenomics',
    items: [
      {
        label: 'CNV multi-quantitative track (COLO829 tumor vs normal)',
        spec: 'cnv',
        description:
          'Whole-genome COLO829 melanoma coverage, tumor and normal on one multi-quantitative track (mosdepth BigWigs).',
      },
      {
        label: 'Clustered multi-sample copy-number track (1000 genomes)',
        spec: 'multiwig/cluster_dialog',
        guide: 'user_guides/multiquantitative_track',
        description:
          'Copy-number profiles for many 1000 Genomes individuals as a multi-row density heatmap. The in-app "Cluster by score" workflow reorders rows by signal similarity.',
      },
      {
        label: 'Hi-C contact matrix (chr8, hg19)',
        spec: 'hic_track',
        description:
          'A Hi-C contact matrix from a .hic file (Juicebox format) over ~11 Mb of chr8, with the RefSeq gene track above.',
      },
      {
        label: 'ChromHMM state painting (Roadmap)',
        spec: 'chromhmm',
        description:
          'Dense chromatin-state annotations from Roadmap Epigenomics (127 epigenomes) in the multi-row feature display.',
      },
      {
        label: 'ChromHMM states (9 ENCODE cell types, β-globin)',
        spec: 'gallery/chromhmm_encode',
        description:
          'ChromHMM chromatin states for 9 ENCODE cell types across the β-globin locus.',
      },
      {
        label: 'ChromHMM states (Roadmap, 127 epigenomes)',
        session:
          '?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"11:5200000-5400000","type":"LinearGenomeView","tracks":["roadmap_chromhmm_multirow_hg19"]}]}',
      },
      {
        label: 'Single-cell ATAC by cell type (CATlas, INS locus)',
        spec: 'gallery/scatac_catlas',
        description:
          'Single-cell ATAC accessibility by cell type (CATlas) around the INS locus, one coverage row per cell type.',
      },
      {
        label: 'ENCODE H3K27ac multi-wiggle (5 cell lines)',
        spec: 'gallery/encode_multibigwig',
        description:
          'ENCODE H3K27ac for five cell lines in one multi-wiggle track; K562 marks the active β-globin locus.',
      },
    ],
  },
  {
    id: 'genes',
    title: 'Genes, proteins, and compact genomes',
    items: [
      {
        label: 'Horizontally flipped linear genome view',
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
        label: 'SARS-CoV2 polyprotein (ORF1ab mature peptides)',
        spec: 'gallery/sarscov2_polyprotein',
        description:
          'The SARS-CoV-2 ORF1ab polyprotein colored by CDS frame and cleaved into its mature peptides.',
      },
      {
        label: 'Enterovirus D polyprotein (mature peptides)',
        spec: 'gene_track_mature_peptides',
        description:
          'The enterovirus D polyprotein cleaved into its mature peptides (VP1, 2A, 3C, …), each a stacked row labeled with its product name.',
      },
      {
        label: 'Human mitochondrion (vertebrate mito code, transl_except stops)',
        spec: 'gallery/human_mito',
        description:
          'The complete human mitochondrial genome — 37 genes and tRNAs — translated with the vertebrate mitochondrial code (transl_table=2).',
      },
      {
        label: 'GPX1 selenoprotein (UGA→Sec readthrough)',
        spec: 'gene_track_selenocysteine',
        description:
          'GPX1\'s in-frame UGA is recoded as selenocysteine. With amino-acid lettering on, that codon shows as a "U" on orange instead of a stop.',
      },
      {
        label: 'Human PTEN gene (color by CDS frame)',
        spec: 'gallery/pten_cds',
        description: 'The human PTEN gene colored by CDS frame.',
      },
      {
        label: 'Maize transposable elements (LTR subparts)',
        session: '?config=test_data%2Fmaize_te%2Fconfig.json',
      },
    ],
  },
  {
    id: 'maf',
    title: 'Multiple genome alignment (MAF)',
    items: [
      {
        label: 'hg38 447-way Cactus alignment (BRCA1)',
        spec: 'gallery/cactus_447way',
        description:
          'The UCSC 447-way Cactus mammalian alignment over BRCA1, all species fit to the display height with a conservation track.',
      },
      {
        label: 'C. elegans 26-way alignment (conservation band)',
        spec: 'gallery/celegans_26way',
        description:
          'A 26-way whole-genome alignment across Caenorhabditis species with a conservation band.',
      },
    ],
  },
  {
    id: 'instances',
    title: 'Full example instances and hubs',
    items: [
      {
        label: 'Human demo instance (many tracks available)',
        session:
          '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
        demoOnly: true,
      },
      {
        label: 'UCSC GenArk hub import (GCF_019202715.1)',
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
