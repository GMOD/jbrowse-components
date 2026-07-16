import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithWiggleTrack() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        sequence: {
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
          },
        },
      }}
      tracks={[
        {
          type: 'QuantitativeTrack',
          trackId: 'volvox_microarray',
          name: 'Microarray (BigWig)',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BigWigAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
          },
          // the `displayDefaults` shorthand routes these settings to the track's
          // LinearWiggleDisplay — pick the renderer, pin the score axis, set colors
          // and height without naming the display
          displayDefaults: {
            defaultRendering: 'xyplot',
            height: 150,
            color: '#a05195',
            minScore: 0,
            maxScore: 1000,
          },
        },
      ]}
      init={{ loc: 'ctgA:1..50,000', tracks: ['volvox_microarray'] }}
    />
  )
}
