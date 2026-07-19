import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

export default function WithTwoLinearGenomeViews() {
  const state1 = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  const state2 = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:5560..30589',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
    </div>
  )
}
