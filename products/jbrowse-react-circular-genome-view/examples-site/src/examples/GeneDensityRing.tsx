import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const tracks = [
  {
    type: 'QuantitativeTrack',
    trackId: 'hg38ToMm39_gene_density',
    name: 'Genes per 100 kb',
    assemblyNames: ['hg38', 'mm39'],
    adapter: {
      type: 'BigWigAdapter',
      uri: 'https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw',
    },
    displays: [
      {
        type: 'LinearWiggleDisplay',
        displayId: 'hg38ToMm39_gene_density-LinearWiggleDisplay',
        defaultRendering: 'density',
        summaryScoreMode: 'avg',
        height: 40,
      },
    ],
  },
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

export default function GeneDensityRing() {
  const state = useCreateViewState({
    jbrowseHub: ['hg38', 'mm39'],
    tracks,
    defaultSession: {
      name: 'hg38 and mm39 with a gene density ring',
      view: { id: 'circularView', type: 'CircularView', height: 700 },
    },
    init: {
      displayedRegionNames: ['chr1', 'chr2', 'chrX'],
      autoDiagonalize: true,
      tracks: ['hg38ToMm39_gene_density', 'hg38ToMm39_blocks'],
    },
  })

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
