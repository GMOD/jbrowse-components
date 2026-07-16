import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithCustomTheme() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      sequence: {
        adapter: {
          type: 'TwoBitAdapter',
          uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
        },
      },
    },
    tracks: [
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
    ],
    configuration: {
      theme: {
        palette: {
          primary: { main: '#311b92' },
          secondary: { main: '#0097a7' },
          tertiary: { main: '#f57c00' },
          quaternary: { main: '#d50000' },
          bases: {
            A: { main: '#98FB98' },
            C: { main: '#87CEEB' },
            G: { main: '#DAA520' },
            T: { main: '#DC143C' },
          },
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
