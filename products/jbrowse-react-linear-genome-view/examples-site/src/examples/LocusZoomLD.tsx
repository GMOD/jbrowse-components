import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// LocusZoom-style demo: genome-wide GIANT BMI summary stats colored by LD r² to
// the lead SNP. The GWAS and PLINK `--r2` files are served from
// jbrowse.org/demos/gwas/. The index SNP auto-tracks the top genome-wide hit
// (rs1121980, FTO locus) — inside the LD window, so FTO shows the colored peak.
// Right-click any SNP to re-anchor LD to it.
const BASE = 'https://jbrowse.org/demos/gwas'
const FTO_LOC = 'chr16:53,700,000..53,900,000'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
    },
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
    // LD source is a sub-adapter on the GWASAdapter; `colorBy: 'ld'` reads its r²
    ldAdapter: {
      type: 'PlinkLDTabixAdapter',
      uri: `${BASE}/plink.ld.tab.gz`,
    },
  },
  displayDefaults: {
    height: 250,
    colorBy: 'ld',
  },
}

const NCBI_REFSEQ_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_refseq_hg19',
  name: 'NCBI RefSeq genes',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'Gff3TabixAdapter',
    // `csi: true` resolves a `.csi` index instead of `.tbi`
    uri: 'https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz',
    csi: true,
  },
  displayDefaults: {
    height: 150,
    labels: {
      name: "jexl:get(feature,'gene_id') || get(feature,'name') || get(feature,'id')",
    },
  },
}

export default function LocusZoomLD() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={[GIANT_BMI_TRACK, NCBI_REFSEQ_TRACK]}
      init={{ loc: FTO_LOC, tracks: ['giant_bmi_ld', 'ncbi_refseq_hg19'] }}
    />
  )
}
