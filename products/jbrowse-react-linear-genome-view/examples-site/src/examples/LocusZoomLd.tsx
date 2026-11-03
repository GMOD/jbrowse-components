import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const BASE = 'https://jbrowse.org/demos/gwas'
const FTO_LOC = 'chr16:53,700,000..53,900,000'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
  },
}

// LocusZoom's r2 bins, shared by the points and the triangle so one r2
// takes one color in both
const R2_BINS = {
  type: 'threshold',
  domain: [0.2, 0.4, 0.6, 0.8],
  range: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
}

const GIANT_BMI_TRACK = {
  type: 'GWASTrack',
  trackId: 'giant_bmi_ld',
  name: 'GIANT BMI (LD colored to lead SNP)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'GWASAdapter',
    scoreColumn: 'neg_log_pvalue',
    uri: `${BASE}/gwas_giant-bmi_meta_women-only.gz`,
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: `${BASE}/plink.ld.tab.gz`,
    },
  },
  displayDefaults: {
    height: 250,
    marks: [
      {
        mark: 'point',
        transform: [
          { type: 'filter', expr: "jexl:feature.ld_role != 'index'" },
        ],
        encoding: {
          y: 'score',
          color: {
            field: 'r2',
            scale: R2_BINS,
            legend: {
              title: 'r² to index SNP',
              descending: true,
              missingLabel: 'No LD data',
            },
          },
        },
      },
      {
        mark: 'point',
        transform: [
          { type: 'filter', expr: "jexl:feature.ld_role == 'index'" },
        ],
        encoding: {
          y: 'score',
          color: { value: '#c951c9' },
          shape: {
            field: 'ld_role',
            scale: {
              domain: ['index'],
              range: ['diamond'],
              names: ['Index SNP'],
            },
            legend: { title: '' },
          },
        },
      },
    ],
  },
}

const EUR_LD_TRACK = {
  type: 'LDTrack',
  trackId: 'fto_eur_ld',
  name: '1000 Genomes EUR LD (r²)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'PlinkLDTabixAdapter',
    uri: `${BASE}/fto_eur.ld.gz`,
    csi: true,
  },
  displayDefaults: {
    height: 300,
    variantLayout: 'genomic',
    encoding: {
      color: { field: 'r2', scale: R2_BINS, legend: { descending: true } },
    },
    legend: { show: true },
  },
}

const NCBI_REFSEQ_TRACK = {
  trackId: 'ncbi_refseq_hg19',
  name: 'NCBI RefSeq genes',
  uri: 'https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz',
  index: 'https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz.csi',
  displayDefaults: {
    height: 150,
    labels: {
      name: "jexl:get(feature,'gene_id') || get(feature,'name') || get(feature,'id')",
    },
  },
}

export default function LocusZoomLd() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={[GIANT_BMI_TRACK, EUR_LD_TRACK, NCBI_REFSEQ_TRACK]}
      view={{
        loc: FTO_LOC,
        tracks: ['giant_bmi_ld', 'fto_eur_ld', 'ncbi_refseq_hg19'],
      }}
    />
  )
}
