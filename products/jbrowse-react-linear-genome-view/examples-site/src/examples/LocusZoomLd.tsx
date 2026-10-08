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
            scale: 'threshold',
            domain: [0.2, 0.4, 0.6, 0.8],
            range: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
            title: 'r² to index SNP',
            descending: true,
            missingLabel: 'No LD data',
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
            domain: ['index'],
            range: ['diamond'],
            labels: ['Index SNP'],
            title: '',
          },
        },
      },
    ],
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
      tracks={[GIANT_BMI_TRACK, NCBI_REFSEQ_TRACK]}
      view={{ loc: FTO_LOC, tracks: ['giant_bmi_ld', 'ncbi_refseq_hg19'] }}
    />
  )
}
