import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithJexlFeatureColorsAndLabels() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'volvox_genes_jexl',
          name: 'Volvox genes (jexl color + label)',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
          },
          displayDefaults: {
            color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
            labels: {
              name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'",
            },
          },
        },
      ]}
      view={{ loc: 'ctgA:1..50,000', tracks: ['volvox_genes_jexl'] }}
    />
  )
}
