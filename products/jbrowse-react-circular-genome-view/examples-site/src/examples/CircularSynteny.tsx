import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const hg38 = {
  name: 'hg38',
  displayName: 'Human (hg38)',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-refseq',
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit',
      chromSizes: 'https://jbrowse.org/ucsc/hg38/hg38.chrom.sizes',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://jbrowse.org/demos/circular_synteny/hg38.chromAlias.txt',
    },
  },
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://jbrowse.org/ucsc/hg38/hg38.cytoBand.txt.gz',
    },
  },
}

const mm39 = {
  name: 'mm39',
  displayName: 'Mouse (mm39)',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'mm39-refseq',
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/mm39/bigZips/mm39.2bit',
      chromSizes: 'https://jbrowse.org/ucsc/mm39/mm39.chrom.sizes',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://jbrowse.org/demos/circular_synteny/mm39.chromAlias.txt',
    },
  },
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://jbrowse.org/ucsc/mm39/mm39.cytoBand.txt.gz',
    },
  },
}

const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'hg38ToMm39_blocks',
    name: 'hg38 vs mm39 (liftOver chains of 100 kb and over)',
    assemblyNames: ['mm39', 'hg38'],
    adapter: {
      type: 'PairwiseIndexedPAFAdapter',
      uri: 'https://jbrowse.org/demos/circular_synteny/hg38ToMm39.blocks.pif.gz',
      queryAssembly: 'mm39',
      targetAssembly: 'hg38',
    },
  },
]

const chromosomes = [
  'chr1',
  'chr2',
  'chr3',
  'chr4',
  'chr5',
  'chr6',
  'chr7',
  'chr8',
  'chr9',
  'chr10',
  'chr11',
  'chr12',
  'chr13',
  'chr14',
  'chr15',
  'chr16',
  'chr17',
  'chr18',
  'chr19',
  'chrX',
]

export default function CircularSynteny() {
  const state = useCreateViewState({
    assembly: [hg38, mm39],
    tracks,
    defaultSession: {
      name: 'hg38 and mm39 on one circle',
      view: { id: 'circularView', type: 'CircularView', height: 700 },
    },
    init: {
      displayedRegionNames: chromosomes,
      autoDiagonalize: true,
      tracks: ['hg38ToMm39_blocks'],
    },
  })

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
