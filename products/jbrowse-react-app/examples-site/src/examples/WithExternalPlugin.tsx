import {
  JBrowseApp,
  createViewStateAsync,
  loadPlugins,
  useCreateViewState,
} from '@jbrowse/react-app2'

const config = {
  assemblies: [
    {
      name: 'hg19',
      aliases: ['GRCh37'],
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
      refNameAliases: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
      },
    },
  ],
  tracks: [
    {
      type: 'FeatureTrack',
      trackId: 'segdups_ucsc_hg19',
      name: 'UCSC SegDups',
      assemblyNames: ['hg19'],
      adapter: { type: 'UCSCAdapter', track: 'genomicSuperDups' },
    },
  ],
  defaultSession: {
    name: 'External plugin example',
    views: [
      {
        id: 'view1',
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc: '1:2,467,681..2,667,681',
        tracks: ['segdups_ucsc_hg19'],
      },
    ],
  },
}

export default function WithExternalPlugin() {
  const state = useCreateViewState(async () =>
    createViewStateAsync({
      config,
      plugins: await loadPlugins([
        {
          name: 'UCSC',
          url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
        },
      ]),
    }),
  )
  return state ? <JBrowseApp viewState={state} /> : null
}
