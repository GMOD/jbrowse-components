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
    'A linear synteny view of chrX in Drosophila simulans (top) and D. mauritiana (bottom), from a minimap2 alignment an AI agent ran. The two reverse-strand blocks, drawn blue, cross in the middle.',
  alphagenome:
    "AlphaGenome's predicted ATAC and DNase accessibility at TAL1 in K562 and GM12878 cells, four rows on one shared y-axis under the RefSeq genes. The K562 rows have the taller peaks.",
  analyze_trio:
    "A 1000 Genomes trio's phased chr1 genotypes as a matrix under the RefSeq genes, with two haplotype rows each for the child, mother and father. Teal cells are alt alleles.",
  dog10k_lof:
    'Dog10K copy number over CYP1A2 on chr30, one row per animal, with wolves, Golden Retrievers, Labradors and Boxers above and every canid in the collection clustered below. Red cells are three or more copies.',
  dog10k_selection:
    'A genome-wide Fst scan between toy and giant dog breeds in Dog10K, one point per 200 kb window, with a dashed line at the 99.9th percentile. The labelled peaks are HMGA2, IGF1 and IGF2BP2.',
  dog10k_svs:
    'A linear synteny view with dog FGF4 between its two intronless retrocopies, on CFA18 above and CFA12 below. Under the gene is one genotype row per Dog10K animal.',
  local_ancestry:
    'FLARE local ancestry along dog chr1, two rows per animal, wolf-derived stretches in orange and dog-derived in blue. Rows are ordered from held-out gray wolves through Saarloos and Czechoslovakian Wolfdogs to other breeds.',
  gene_prediction_review:
    'Tiberius gene predictions above GENCODE on human chr22. One predicted model, g14001.t1, spans IL17REL and TTLL8, which GENCODE annotates as two separate genes.',
  rnaseq:
    'Stranded paired-end RNA-seq reads over human ACTB, with coverage and splice arcs above the read pileup. Thin teal lines join the two parts of each spliced read across an intron.',
  dtu: 'Skeletal muscle and liver RNA-seq coverage over ATP5F1C on one shared scale, above the GENCODE transcripts colored by the change in isoform fraction between the two tissues. The boxed exon has coverage in liver only.',
  methylation:
    'HG002 nanopore reads at the SNRPN CpG island, grouped by haplotype, with a per-haplotype 5mC methylation profile above them. Over the island, HP1 reads are methylated (red) and HP2 reads unmethylated (blue).',
  bisulfite:
    'Arabidopsis bisulfite (WGBS) reads over the gene AT1G12930 and a Copia transposon, in three copies colored by CpG, CHG and CHH methylation. Red calls cover the transposon in all three, the gene in CpG only.',
  chromhmm:
    'ChromHMM chromatin states for the Roadmap epigenomes on human chr9, one row per epigenome, banded by tissue group. Over the boxed PAX5, the B-cell rows are green and yellow, the colors of transcription with genic enhancers.',
  scrna_pseudobulk:
    "10x PBMC single-cell RNA-seq at the 3' end of LYZ, as pooled coverage per cell type above one row per cell, ordered and colored by cell type. Coverage is highest in the monocyte rows.",
  ld_human:
    'Two linkage disequilibrium (r²) triangles around LCT on human chr2, all 1000 Genomes populations pooled above the European panel, under Fst and a deCODE recombination map. The European triangle has the darker block over LCT.',
  ld_mosquitoes:
    "Linkage disequilibrium (r²) across arm 2L of Anopheles gambiae for Cameroon and Gabon, each above that population's mosquitoes genotyped for the 2La inversion. Cameroon's triangle has a block spanning 2La, and Gabon's has none.",
  bxd_qtl:
    "A coat-color QTL scan of BXD mice on chr4 above each strain's painted genotype, B6 blocks in blue and DBA/2 in red, with rows grouped by coat color. The scan peaks at Tyrp1.",
  population_genomics:
    "Fst between Drosophila melanogaster lines with and without the In(2L)t inversion, in 2 kb windows across the dm6 chromosome arms, with the inversion's extent marked above. Fst is highest over the inversion on chr2L.",
  k562_fusions:
    "K562 PacBio Iso-Seq reads at the NUP214-XKR3 fusion, chr9 beside a flipped chr22, under STAR-Fusion's calls. Each line is one RNA molecule, NUP214 sequence on the left and XKR3 on the right.",
  sv_visualization_cgiab:
    "A chr13-chr3 translocation in the HG008 pancreatic tumor, PacBio HiFi split reads at both GRCh38 breakends above the tumor assembly's fused chromosome. Realigned to the assembly, the same reads cross the junction unbroken.",
  cnv_cgiab:
    'Copy number along chr3 in the HG008 tumor, as segmented copy ratio, HiFiCNV read depth and B-allele frequency over the benchmark CNV calls. Depth is lower across the p-arm, where the B-allele frequency has no middle band.',
  sv_callset_review:
    'COLO829 tumor nanopore reads at three loci on chr3, chr10 and chr12, in one breakpoint image rendered from the command line. Curves join the pieces of each split read, red same-strand and purple inverted.',
  hic_structural_variants:
    'Hi-C tracks for GM12878 (top) and K562 leukemia cells (bottom) over chr9 at ABL1 and chr22 at BCR. Only the K562 track has a wedge of contacts between the two windows.',
  mappability_qc:
    'NA12878 Illumina reads at SMN1 on chr5, one read per row and colored by mapping quality, under Umap mappability and gnomAD coverage tracks. Most reads are dark blue, the color for mapping quality 0.',
  genomes_proteins:
    'TP53 from the genomes.jbrowse.org protein browser, opened on residue R248 in three linked views. The gene sits over ClinVar and AlphaMissense tracks, beside a P53 family alignment and the 3KMD structure with R248 in magenta.',
  protein_variants_sickle_cell:
    'HBB at codon 7, the sickle-cell site, beside an HBB ortholog alignment and the 2HBS structure of sickle haemoglobin. The yellow band on the gene, the orange alignment column and Val6 on the structure mark the same residue.',
  protein_variants_dog_myelopathy:
    'Dog10K genotypes at SOD1 on the canFam4 dog genome, one row per canid, beside an ortholog alignment and the 7WX0 structure. In the highlighted E40K column, no wolf or coyote row has the alternate allele.',
  protein_variants_kras:
    "KRAS codons 12, 13 and 61 highlighted in three linked views, the gene, an ortholog alignment and the 6OIM structure. All three views are colored by the protein's domains and sites.",
  protein_variants_met_exon14:
    'MET exons 13 to 15 with reads from the NCI-H596 and EBC-1 lung cancer cell lines, beside the 3BUX structure. The NCI-H596 RNA-seq track has a splice arc from exon 13 to exon 15.',
  synteny_visualization:
    "Three Helicobacter pylori strains, 26695, CHC155 and J99, stacked with a gene track on each row and alignment ribbons between rows. The ribbons between CHC155 and J99 cross over J99's inverted block.",
  mcscan_synteny_grape_peach:
    'Peach chromosome G5 against grape chromosome 2 from an MCScan run, with a ribbon for each pair of matching genes and a bar for each block of genes in conserved order.',
  multiway_synteny_grape_peach_cacao:
    "Peach, cacao and grape stacked as rows from one MCScan table of genes in conserved order, with a ribbon per matching gene pair. Both bands are colored by cacao's chromosomes in the middle row.",
  selection_pressure:
    'Human chromosome 12 against rhesus macaque around LYZ, the lysozyme gene, with a ribbon for each ortholog pair colored by dN/dS. The LYZ ribbon is orange, and the ribbons of its neighbours are blue.',
  hg002_haplotypes:
    'The maternal (top) and paternal (bottom) copies of chromosome 8 at 8p23.1 in the T2T-HG002 diploid assembly, with genes colored by strand. The long blue bar and the blue ribbons are the inverted block.',
  homoeolog_synteny:
    'A dotplot of the hexaploid oat genome against itself over chromosome groups 4, 5 and 7. Each dot is a pair of homoeologous genes, colored by dS, their divergence at silent sites.',
  orthofinder_synteny:
    "Aegilops tauschii over bread wheat, with a link for each OrthoFinder ortholog pair, colored by tauschii chromosome. Each tauschii chromosome's links end on the A, B and D chromosomes of its wheat group.",
  primate_orthologs_synteny:
    'TP53 on human chr17 above lanes for seven other primates, with RefSeq genes in each lane and ribbons between matching genes. Ribbons above and below the siamang lane are blue, inverted against the lane above.',
  circular_synteny:
    "Human (hg38) and mouse (mm39) chromosomes around one circle, with a ribbon for each block of UCSC's human-to-mouse liftOver chain. The inner ring is gene density, darker where genes are dense.",
  organelle_map:
    'The human mitochondrial genome, NC_012920.1, as a circular map with base-pair ticks around the ring and the NCBI genes in a row per strand, colored by feature type.',
  t2t_apes_cactus_synteny:
    'ERBB2 on human chr17 above six T2T ape lanes, with Cactus alignment ribbons from each lane to the one above, colored by strand. Ribbons are blue from human to chimpanzee and from gorilla to Sumatran orangutan.',
  hg38_vertebrates_synteny:
    "The human TP53 region above eight lanes of mammal genomes, chimp to cow, joined to hg38 by UCSC liftOver chains, each lane with that genome's RefSeq genes. The mouse ribbons are blue, for the reverse strand.",
  syri_synteny:
    'Chromosome 4 of the Arabidopsis accessions Col-0 (top) and Ler (bottom), with aligned regions colored by SyRI type (syntenic, inverted, translocated or duplicated). The orange crossed ribbon is the inversion on the short arm.',
  odp_linkage_groups_synteny:
    'Two comb jellies, a jellyfish, amphioxus and two sponges stacked as bands, with ortholog ribbons colored by ancestral linkage group. Ribbons are solid between significantly paired chromosomes and faint elsewhere.',
  allvsall_synteny:
    'Five E. coli strains stacked as rows from K12 to IAI39, with ribbons between neighboring rows from one minimap2 all-vs-all alignment. The crossing ribbons between NCTC86 and IAI39 are inversions.',
  pangenome_ecoli:
    'E. coli K12 genes above the pggb pangenome depth of five strains and a presence row for each other strain. Across the shaded span the IAI39 row is empty and the depth track falls.',
  genomes_synteny:
    'TNNT3 on chromosome 11 in hg38 (top) and the T2T-CHM13 human reference (bottom), joined by curved liftOver ribbons colored by strand. The blue ribbons are the reverse-strand alignments.',
  genomes_basics:
    'TP53 on human chromosome 17 at single-base zoom, with the protein translation, phyloP conservation scores and the 470-way mammal multiple alignment. An alignment row has a colored base where that species differs from human.',
  pangenome_hprc:
    "HLA-DRB5 in MHC class II on GRCh38, with the HPRC phased VCF clustered by genotype above the force-directed pangenome graph. The arrow joins the HLA-DRB5 allele's shaded band to the same allele in the graph.",
  pangenome_hprc_repeats:
    'LPA on GRCh38 with UniProt kringle domains, the HPRC bubbles track and the force-directed pangenome graph. The haloed knot of loops on the right of the graph is the KIV-2 repeat array.',
  pangenome_mouse:
    'The Dock2 intron on mouse chromosome 11, with the mouse strain pangenome as a bubbles track and a force-directed graph. Each charcoal loop below the colored reference line is sequence the C57BL/6J reference lacks.',
  pangenome_cattle:
    'Upstream of KIT on cattle chromosome 6, the bovine super-pangenome callset has one row per assembly above a graph track. The deletion is a dashed arc in the graph, and the Simmental row is red.',
  pangenome_cactus:
    'Five E. coli strains aligned to K12 by Minigraph-Cactus, one multiple-alignment row per strain under the K12 genes. A row stops where that strain has no alignment to K12, here across intZ and the yff genes.',
  tcga_cohort_cnv:
    'Copy-number segments for TCGA breast tumors across the genome, one row per tumor clustered by profile, under a track of gain (red) and loss (blue) frequency. Labels mark the stripes at MYC, CDKN2A, CCND1 and ERBB2.',
  tcga_cohort_mutations:
    'Mutation rate per gene across the genome for TCGA breast tumors, one row per receptor subtype. The labelled spikes are PIK3CA in the HR+/HER2- row and TP53 in the triple-negative row.',
  population_cnv:
    'Copy number for the 1000 Genomes panel at CCL3L1 and CCL4L1 on chromosome 17, one row per individual from a Zarr store, clustered. Red is a gain, blue a loss and white two copies.',
  cookbook:
    'Copy number for eight samples at the amylase (AMY) genes on human chromosome 1, one line and color per sample on a shared scale. The lines step up or down across the AMY genes.',
  repeatmasker_classes:
    'Human 17q21 with the RepeatMasker track as one packed row colored by repeat class (top) and as a labelled row per class (bottom). In the class rows, SINE copies span the window and LINE copies cluster.',
  gene_density:
    'Human chromosome 1 end to end, with RefSeq genes, Alu, L1 and simple repeats each counted per kilobase on a separate scale. The Alu track peaks where the gene track peaks.',
  protein_domains:
    'Honey bee Su(var)3-9 transcripts, one row each, with Pfam protein domains colored by family over the coding exons. The NM_001040277.1 row has Chromo, Pre-SET and SET domains; the NM_001171169.1 row has GTP_EFTU and eIF2_C.',
  alu_age:
    'Alu repeat copies per bin along human chromosome 1, grey for all copies and red for the AluY subfamily, above the AluY share per megabase. Red bars are above the genome-wide AluY share and blue bars below it.',
  read_marks:
    'NA12878 reads on chromosome 20 at a deletion in EFCAB8, with read depth above and the insert size of each read pair as a point below. Pairs that straddle the shaded deletion form the high group of points.',
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
