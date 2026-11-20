import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CODE_BASE, liveHref } from './code-base.ts'
import { entrySlug } from './docs-sidebar.ts'
import {
  TUTORIAL_CATEGORIES,
  TUTORIAL_EXTRA_DOCS,
  TUTORIAL_FALLBACK,
  TUTORIAL_ORDER,
} from './guide-categories.ts'
import { figureLiveRefs } from './liveLinks.generated.ts'
import { TUTORIAL_THUMB_SPECS } from './tutorial-thumbs.ts'

interface DocEntry {
  id: string
  data: { title: string; tutorial_category?: string }
}

export const genomePreviewFigure = 'home/tp53_promoter'

export const demoCaptions: Record<string, string> = {
  agent_synteny:
    'Drosophila simulans against D. mauritiana on chrX, from a minimap2 alignment an AI agent ran.',
  alphagenome:
    "AlphaGenome's predicted ATAC and DNase accessibility at TAL1 in K562 and GM12878 cells.",
  analyze_trio: "A 1000 Genomes trio's phased genotypes on chr1.",
  dog10k_lof: 'Dog10K copy number over CYP1A2 on chr30.',
  dog10k_selection:
    'A genome-wide Fst scan between toy and giant dog breeds in Dog10K.',
  dog10k_svs:
    'Dog FGF4 and its two retrocopies on CFA18 and CFA12, with Dog10K genotypes.',
  local_ancestry: 'FLARE wolf and dog local ancestry along dog chr1.',
  gene_prediction_review:
    'Tiberius gene predictions against GENCODE on human chr22, at a model that joins IL17REL and TTLL8.',
  rnaseq: 'Stranded paired-end RNA-seq over human ACTB.',
  dtu: 'Skeletal muscle and liver RNA-seq over ATP5F1C, with transcripts colored by the change in isoform fraction.',
  methylation:
    'HG002 nanopore 5mC methylation at the SNRPN CpG island, grouped by haplotype.',
  bisulfite:
    'Arabidopsis bisulfite reads over AT1G12930 and a Copia transposon, in CpG, CHG and CHH contexts.',
  chromhmm: 'ChromHMM chromatin states for the Roadmap epigenomes around PAX5.',
  scrna_pseudobulk:
    '10x PBMC single-cell RNA-seq at LYZ, grouped by cell type.',
  ld_human:
    'Linkage disequilibrium around LCT for all 1000 Genomes populations and the European panel.',
  ld_mosquitoes:
    'Linkage disequilibrium across Anopheles gambiae arm 2L in Cameroon and Gabon, with 2La inversion genotypes.',
  bxd_qtl:
    "A coat-color QTL scan of BXD mice at Tyrp1, with each strain's B6 and DBA/2 genotype.",
  population_genomics:
    'Fst between Drosophila melanogaster lines with and without the In(2L)t inversion.',
  k562_fusions:
    "K562 PacBio Iso-Seq reads across the NUP214-XKR3 fusion, with STAR-Fusion's calls.",
  sv_visualization_cgiab:
    'PacBio HiFi split reads at a chr13-chr3 translocation in the HG008 tumor, on GRCh38 and on the tumor assembly.',
  cnv_cgiab:
    'Copy ratio, read depth and B-allele frequency along chr3 in the HG008 tumor.',
  sv_callset_review:
    'COLO829 tumor nanopore reads at three breakpoints, in one image rendered from the command line.',
  hic_structural_variants: 'GM12878 and K562 Hi-C at ABL1 and BCR.',
  mappability_qc:
    'NA12878 reads at SMN1 colored by mapping quality, with Umap mappability and gnomAD coverage.',
  genomes_proteins:
    'TP53 residue R248 in the genomes.jbrowse.org protein browser, with a P53 family alignment and the 3KMD structure.',
  protein_variants_sickle_cell:
    'The HBB sickle-cell codon in the gene, an ortholog alignment and the 2HBS structure.',
  protein_variants_dog_myelopathy:
    'Dog10K genotypes at SOD1 E40K, with an ortholog alignment and the 7WX0 structure.',
  protein_variants_kras:
    'KRAS codons 12, 13 and 61 in the gene, an ortholog alignment and the 6OIM structure.',
  protein_variants_met_exon14:
    'MET exons 13 to 15 with NCI-H596 and EBC-1 lung cancer reads, beside the 3BUX structure.',
  synteny_visualization:
    'Three Helicobacter pylori strains, 26695, CHC155 and J99, with genes and alignments.',
  mcscan_synteny_grape_peach:
    'Peach chromosome G7 against grape chromosome 11 from an MCScan run, in order apart from two short inversions.',
  multiway_synteny_grape_peach_cacao:
    'Peach, cacao and grape from one MCScan table of genes in conserved order.',
  selection_pressure:
    'Human chromosome 12 against rhesus macaque around LYZ, with ortholog pairs colored by dN/dS.',
  hg002_haplotypes:
    'The 8p23.1 inversion between the maternal and paternal chromosome 8 of the T2T-HG002 diploid assembly.',
  homoeolog_synteny:
    'A dotplot of hexaploid oat against itself, with homoeologous gene pairs colored by dS.',
  orthofinder_synteny:
    'Aegilops tauschii against bread wheat, with a link per OrthoFinder ortholog pair.',
  primate_orthologs_synteny:
    'TP53 on human chr17 and seven other primates, with ribbons between matching genes.',
  circular_synteny:
    'Human and mouse chromosomes in a circle, joined by UCSC liftOver chains, with gene density.',
  organelle_map:
    'The human mitochondrial genome, NC_012920.1, as a circular map.',
  t2t_apes_cactus_synteny:
    'ERBB2 across human and six T2T ape genomes, from a Cactus alignment.',
  hg38_vertebrates_synteny:
    'The human TP53 region and eight mammal genomes, joined by UCSC liftOver chains.',
  syri_synteny:
    'Arabidopsis Col-0 and Ler chromosome 4, with aligned regions colored by SyRI type.',
  odp_linkage_groups_synteny:
    'Comb jellies, a jellyfish, amphioxus and sponges, with ortholog ribbons colored by ancestral linkage group.',
  allvsall_synteny:
    'Five E. coli strains from one minimap2 all-vs-all alignment.',
  pangenome_ecoli:
    'E. coli K12 genes with the pggb pangenome depth of five strains and presence per strain.',
  genomes_synteny: 'TNNT3 in hg38 and T2T-CHM13, joined by liftOver.',
  genomes_basics:
    'TP53 at single-base zoom, with the protein translation, phyloP and the 470-way mammal alignment.',
  pangenome_hprc:
    'HLA-DRB5 on GRCh38, with HPRC genotypes and the pangenome graph.',
  pangenome_hprc_repeats:
    'The LPA KIV-2 repeat array on GRCh38, with UniProt kringle domains and the HPRC pangenome graph.',
  pangenome_mouse:
    'A Dock2 intron in the mouse strain pangenome, as bubbles and as a graph.',
  pangenome_cattle: 'A deletion upstream of KIT in the bovine super-pangenome.',
  pangenome_cactus: 'Five E. coli strains aligned to K12 by Minigraph-Cactus.',
  tcga_cohort_cnv:
    'Copy-number segments for TCGA breast tumors across the genome, with gain and loss frequency.',
  tcga_cohort_mutations:
    'Mutation rate per gene for TCGA breast tumors, by receptor subtype.',
  population_cnv:
    '1000 Genomes copy number at CCL3L1 and CCL4L1, read from a Zarr store.',
  cookbook: 'Copy number for eight samples at the human amylase (AMY) genes.',
  repeatmasker_classes:
    'RepeatMasker at human 17q21, as one row and as a row per repeat class.',
  gene_density:
    'Gene, Alu, L1 and simple-repeat density along human chromosome 1.',
  protein_domains: 'Pfam protein domains on honey bee Su(var)3-9 transcripts.',
  alu_age:
    'Alu copies along human chromosome 1, and the share of them in the AluY subfamily.',
  read_marks: 'NA12878 read depth and insert sizes at a deletion in EFCAB8.',
}

const trackSelector = {
  widgets: {
    hierarchicalTrackSelector: {
      id: 'hierarchicalTrackSelector',
      type: 'HierarchicalTrackSelectorWidget',
      view: 'main',
    },
  },
  activeWidgets: { hierarchicalTrackSelector: 'hierarchicalTrackSelector' },
}

function genomeHref(
  name: string,
  assembly: string,
  loc: string,
  tracks: string[],
) {
  const session = {
    session: {
      name,
      views: [
        {
          id: 'main',
          type: 'LinearGenomeView',
          init: { assembly, loc, tracks },
        },
      ],
      ...trackSelector,
    },
  }
  return `${CODE_BASE}?session=json-${encodeURIComponent(JSON.stringify(session))}`
}

export const referenceGenomes = [
  {
    name: 'Human (hg38)',
    open: genomeHref('Human (hg38)', 'hg38', 'chr17:7,661,000-7,690,000', [
      'mane_hg38',
    ]),
    full: 'https://genomes.jbrowse.org/ucsc/hg38/',
  },
  {
    name: 'Human (hg19)',
    open: genomeHref('Human (hg19)', 'hg19', 'chr17:7,566,000-7,595,000', [
      'ncbi_gff_hg19',
    ]),
    full: 'https://genomes.jbrowse.org/ucsc/hg19/',
  },
]

function missing(what: string): never {
  throw new Error(`showcase.ts: ${what}`)
}

const figureSizes = new Map(
  readFileSync(join(process.cwd(), '..', 'figures.lock'), 'utf8')
    .split('\n')
    .flatMap(line => {
      const [path = '', size = ''] = line.split(' ')
      const [width, height] = size.split('x').map(Number)
      const name = /^website\/static\/img\/(.+)\.png$/.exec(path)?.[1]
      return name !== undefined && width && height
        ? [[name, { width, height }] as const]
        : []
    }),
)

const DEMO_WIDTH = 1200

function demoImageSize(figure: string) {
  const size =
    figureSizes.get(figure) ?? missing(`${figure} is not in figures.lock`)
  const width = Math.min(size.width, DEMO_WIDTH)
  return { width, height: Math.round((size.height * width) / size.width) }
}

function docHref(baseUrl: string, entry: DocEntry) {
  return `${baseUrl}/docs/${entrySlug(entry.id)}/`
}

export function figureLiveHref(name: string) {
  const ref = figureLiveRefs[name]
  return ref === undefined ? missing(`${name} has no live link`) : liveHref(ref)
}

function tutorialDoc(docs: DocEntry[], key: string) {
  return (
    docs.find(d => d.id === `tutorials/${key}`) ??
    docs.find(d => d.id === key) ??
    missing(`${key} is not a tutorial`)
  )
}

const rank = (key: string) => {
  const i = TUTORIAL_ORDER.indexOf(key)
  return i === -1 ? TUTORIAL_ORDER.length : i
}

export function demoSections(docs: DocEntry[], baseUrl: string) {
  const demos = Object.entries(demoCaptions)
    .map(([key, caption]) => {
      const spec =
        TUTORIAL_THUMB_SPECS[key] ??
        missing(`${key} has no entry in tutorial-thumbs.ts`)
      const figure = spec.src.replace(/\.png$/, '')
      const entry = tutorialDoc(docs, key)
      return {
        key,
        caption,
        title: entry.data.title,
        href: docHref(baseUrl, entry),
        live:
          figureLiveRefs[figure] === undefined
            ? undefined
            : liveHref(figureLiveRefs[figure]),
        img: `${baseUrl}/img/demo-figures/${key}.webp`,
        ...demoImageSize(figure),
        category:
          TUTORIAL_EXTRA_DOCS[key] ??
          entry.data.tutorial_category ??
          TUTORIAL_FALLBACK,
      }
    })
    .sort((a, b) => rank(a.key) - rank(b.key))
  return [
    ...TUTORIAL_CATEGORIES.filter(c => c !== 'genomes.jbrowse.org'),
    TUTORIAL_FALLBACK,
    'genomes.jbrowse.org',
  ]
    .map(category => ({
      category,
      demos: demos.filter(d => d.category === category),
    }))
    .filter(section => section.demos.length > 0)
}
