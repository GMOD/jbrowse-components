import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WiggleTrack() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          trackId: 'volvox_microarray',
          name: 'Microarray (BigWig)',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
          displayDefaults: {
            mark: 'bar',
            height: 150,
            encoding: {
              y: { scale: { domainMin: 0, domainMax: 1000 } },
              color: { value: '#a05195' },
            },
          },
        },
      ]}
      view={{ loc: 'ctgA:1..50,000', tracks: ['volvox_microarray'] }}
    />
  )
}
