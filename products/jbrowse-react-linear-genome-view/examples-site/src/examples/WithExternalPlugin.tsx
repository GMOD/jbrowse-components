import { useEffect, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
  loadPlugins,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
    },
  },
}

type ViewState = ReturnType<typeof createViewState>

export default function App() {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewState>()

  useEffect(() => {
    void (async () => {
      try {
        const plugins = await loadPlugins([
          {
            name: 'UCSC',
            url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
          },
        ])
        const state = createViewState({
          assembly,
          plugins: plugins.map(p => p.plugin),
          tracks: [
            {
              type: 'FeatureTrack',
              trackId: 'segdups_ucsc_hg19',
              name: 'UCSC SegDups',
              assemblyNames: ['hg19'],
              adapter: { type: 'UCSCAdapter', track: 'genomicSuperDups' },
            },
          ],
          location: '1:2,467,681..2,667,681',
        })
        state.session.view.showTrack('segdups_ucsc_hg19')
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorBanner error={error} />
  ) : !viewState ? (
    <div>Loading...</div>
  ) : (
    <JBrowseLinearGenomeView viewState={viewState} />
  )
}
