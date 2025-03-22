This is an example of an assembly and tracks configuration for a simple human
genome example using publicly hosted data files. It includes the GRCh38
reference sequence and a genes track.

```tsx
import '@fontsource/roboto'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi_refseq_109_hg38',
    name: 'NCBI RefSeq (GFF3Tabix)',
    assemblyNames: ['GRCh38'],
    category: ['Annotation'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
]

const defaultSession = {
  name: 'My session',
  view: {
    id: 'linearGenomeView',
    type: 'LinearGenomeView',
    tracks: [
      {
        type: 'ReferenceSequenceTrack',
        configuration: 'GRCh38-ReferenceSequenceTrack',
        displays: [
          {
            type: 'LinearReferenceSequenceDisplay',
            configuration:
              'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
          },
        ],
      },
      {
        type: 'FeatureTrack',
        configuration: 'ncbi_refseq_109_hg38',
        displays: [
          {
            type: 'LinearBasicDisplay',
            configuration: 'ncbi_refseq_109_hg38-LinearBasicDisplay',
          },
        ],
      },
    ],
  },
}

function View() {
  const state = createViewState({
    assembly,
    tracks,
    location: '10:29,838,737..29,838,819',
    defaultSession,
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export default View
```

This is what the component should look like:

![a view](./img/exampleView.png)
