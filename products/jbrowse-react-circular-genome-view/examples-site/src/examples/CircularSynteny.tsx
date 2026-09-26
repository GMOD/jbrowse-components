import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'hg38ToMm39_liftover',
    name: 'hg38 to mm39 liftOver chain',
    assemblyNames: ['mm39', 'hg38'],
    adapter: {
      type: 'PairwiseIndexedPAFAdapter',
      uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz',
      csi: true,
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
    jbrowseHub: ['hg38', 'mm39'],
    tracks,
    view: {
      height: 700,
      displayedRegionNames: chromosomes,
      minAlignmentLength: 100_000,
      tracks: ['hg38ToMm39_liftover'],
    },
  })

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
