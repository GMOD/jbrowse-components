import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: props are initial values, the component owns the engine — no
// createViewState / useState ceremony
export default function WithJexlFeatureColorsAndLabels() {
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
          type: 'FeatureTrack',
          trackId: 'volvox_genes_jexl',
          name: 'Volvox genes (jexl color + label)',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
          },
          // `displayDefaults` shorthand routes each setting to the track's
          // display. `color` and `labels.name` accept a `jexl:` expression
          // evaluated per feature (`feature` is in scope) — here: color by
          // strand, label with type.
          displayDefaults: {
            color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
            labels: {
              name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'",
            },
          },
          // Equivalent explicit form (use when you need the display
          // type/displayId):
          // displays: [
          //   {
          //     type: 'LinearBasicDisplay',
          //     displayId: 'volvox_genes_jexl-LinearBasicDisplay',
          //     color: "jexl:get(feature,'strand')==1?'#1f77b4':'#d62728'",
          //     labels: { name: "jexl:get(feature,'name')+' ['+get(feature,'type')+']'" },
          //   },
          // ],
        },
      ]}
      init={{ loc: 'ctgA:1..50,000', tracks: ['volvox_genes_jexl'] }}
    />
  )
}
