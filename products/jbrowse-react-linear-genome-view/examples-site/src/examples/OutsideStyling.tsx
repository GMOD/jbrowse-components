import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function OutsideStyling() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    location: 'ctgA:1105..1221',
  })
  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      {state ? <JBrowseLinearGenomeView viewState={state} /> : null}
    </div>
  )
}
