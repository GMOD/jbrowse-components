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
    trackId: 'hg38ToMm39_gene_density',
    name: 'Genes per 100 kb',
    uri: 'https://jbrowse.org/demos/circular_synteny/hg38ToMm39.genes.gff.density.bw',
    type: 'QuantitativeTrack',
    assemblyNames: ['hg38', 'mm39'],
    displays: [
      {
        type: 'LinearWiggleDisplay',
        displayId: 'hg38ToMm39_gene_density-LinearWiggleDisplay',
        mark: 'span',
        aggregate: 'mean',
        height: 40,
      },
    ],
  },
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

export default function GeneDensityRing() {
  const state = useCreateViewState({
    assembly,
    tracks,
    view: {
      height: 700,
      displayedRegionNames: ['chr1', 'chr2', 'chrX'],
      minAlignmentLength: 100_000,
      tracks: ['hg38ToMm39_gene_density', 'hg38ToMm39_liftover'],
    },
  })

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
