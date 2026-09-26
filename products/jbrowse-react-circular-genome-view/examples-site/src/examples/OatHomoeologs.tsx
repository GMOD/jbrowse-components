import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const base = 'https://jbrowse.org/demos/oat_homoeologs'

const assembly = {
  name: 'oat',
  sequence: {
    adapter: { type: 'ChromSizesAdapter', uri: `${base}/oat.chrom.sizes` },
  },
}

const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'oat_homoeologs',
    name: 'Oat homoeologs',
    assemblyNames: ['oat', 'oat'],
    adapter: {
      type: 'MCScanBlocksAdapter',
      uri: `${base}/oat.homoeologs.blocks.gz`,
      blockAssemblies: ['oat', 'oat'],
      bedLocations: [`${base}/oat.bed.gz`, `${base}/oat.bed.gz`],
    },
  },
]

export default function OatHomoeologs() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ height: 700, tracks: ['oat_homoeologs'] }}
    />
  )
}
