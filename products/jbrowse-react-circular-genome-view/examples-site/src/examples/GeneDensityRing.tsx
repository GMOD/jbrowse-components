import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const assembly = [
  { name: 'hg38', displayName: 'Human (hg38)' },
  { name: 'mm39', displayName: 'Mouse (mm39)' },
].map(({ name, displayName }) => ({
  name,
  displayName,
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: `https://hgdownload.soe.ucsc.edu/goldenPath/${name}/bigZips/${name}.2bit`,
      chromSizes: `https://jbrowse.org/ucsc/${name}/${name}.chrom.sizes`,
    },
  },
  refNameAliases: {
    uri: `https://jbrowse.org/demos/circular_synteny/${name}.chromAlias.txt`,
  },
}))

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
        mark: 'heatmap',
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
    assembly,
    tracks,
    view: {
      height: 700,
      displayedRegionNames: ['chr1', 'chr2', 'chrX'],
      autoDiagonalize: true,
      tracks: ['hg38ToMm39_gene_density', 'hg38ToMm39_blocks'],
    },
  })

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
