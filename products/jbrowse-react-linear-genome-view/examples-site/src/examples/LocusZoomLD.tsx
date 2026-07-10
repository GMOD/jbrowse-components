import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

// LocusZoom-style demo: genome-wide GIANT BMI summary stats colored by LD r² to
// the lead SNP. The GWAS file is read straight from LocusZoom's hosted demo
// data (its `#chrom pos rsid …` tabix layout, no end column) and the LD from
// their headerless PLINK `--r2` file — both served via jbrowse.org/demos/gwas/.
// The index SNP auto-tracks the top genome-wide hit (rs1121980 at the FTO
// locus), which is inside the LD window, so zooming to FTO shows the colored
// peak. Right-click any SNP to re-anchor LD to it.
const BASE = 'https://jbrowse.org/demos/gwas'

// FTO/BMI locus on hg19 — the lead SNP and its LD partners.
const FTO_LOC = 'chr16:53,700,000..53,900,000'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    },
  },
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
    bedGzLocation: { uri: `${BASE}/gwas_giant-bmi_meta_women-only.gz` },
    index: {
      location: { uri: `${BASE}/gwas_giant-bmi_meta_women-only.gz.tbi` },
    },
  },
  displays: [
    {
      type: 'LinearManhattanDisplay',
      displayId: 'giant_bmi_ld-LinearManhattanDisplay',
      height: 250,
      colorBy: 'ld',
      ldAdapter: {
        type: 'PlinkLDTabixAdapter',
        ldLocation: { uri: `${BASE}/plink.ld.tab.gz` },
        index: {
          indexType: 'TBI',
          location: { uri: `${BASE}/plink.ld.tab.gz.tbi` },
        },
      },
    },
  ],
}

const NCBI_REFSEQ_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_refseq_hg19',
  name: 'NCBI RefSeq genes',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'Gff3TabixAdapter',
    // `csi: true` makes the `uri` shorthand resolve a `.csi` index
    uri: 'https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz',
    csi: true,
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'ncbi_refseq_hg19-LinearBasicDisplay',
      height: 150,
      labels: {
        name: "jexl:get(feature,'gene_id') || get(feature,'name') || get(feature,'id')",
      },
    },
  ],
}

export default function LocusZoomLD() {
  const state = useCreateViewState({
    assembly,
    tracks: [GIANT_BMI_TRACK, NCBI_REFSEQ_TRACK],
    defaultSession: {
      name: 'LocusZoom-style LD coloring',
      view: {
        type: 'LinearGenomeView',
        init: {
          assembly: 'hg19',
          loc: FTO_LOC,
          tracks: ['giant_bmi_ld', 'ncbi_refseq_hg19'],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
