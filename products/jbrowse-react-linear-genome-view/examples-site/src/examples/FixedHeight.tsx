import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function FixedHeight() {
  return (
    // the host's own box, which is how an embedder asks for a fixed height
    // today -- there is no height prop. Drag the corner to resize it
    <div style={{ height: 400, overflowY: 'auto', resize: 'vertical' }}>
      <LinearGenomeView
        assembly={{
          name: 'volvox',
          uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
        }}
        tracks={[
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
          {
            type: 'QuantitativeTrack',
            trackId: 'volvox_microarray',
            name: 'Microarray (BigWig)',
            assemblyNames: ['volvox'],
            adapter: {
              type: 'BigWigAdapter',
              uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
            },
            displayDefaults: { height: 150 },
          },
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox-long-reads-sv-bam',
            name: 'volvox-long reads with SV',
            assemblyNames: ['volvox'],
            adapter: {
              type: 'BamAdapter',
              uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-long-reads-sv.bam',
            },
            displayDefaults: { height: 200 },
          },
        ]}
        init={{
          loc: 'ctgA:1..50,000',
          tracks: [
            'volvox_gff3',
            'volvox_microarray',
            'volvox-long-reads-sv-bam',
          ],
        }}
      />
    </div>
  )
}
