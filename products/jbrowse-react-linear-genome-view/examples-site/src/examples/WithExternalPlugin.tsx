import { useEffect, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
  destroyViewState,
  loadPlugins,
} from '@jbrowse/react-linear-genome-view2'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

export default function WithExternalPlugin() {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewModel>()

  useEffect(() => {
    const mount = {
      unmounted: false,
      engine: undefined as ViewModel | undefined,
    }
    void (async () => {
      try {
        const plugins = await loadPlugins([
          {
            name: 'UCSC',
            url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
          },
        ])
        if (mount.unmounted) {
          return
        }
        const state = createViewState({
          assembly: {
            name: 'hg19',
            aliases: ['GRCh37'],
            uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
            refNameAliases: {
              uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
            },
          },
          plugins,
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
        await state.session.view.launchTrack('segdups_ucsc_hg19')
        mount.engine = state
        setViewState(state)
      } catch (e) {
        setError(e)
      }
    })()
    return () => {
      mount.unmounted = true
      if (mount.engine) {
        destroyViewState(mount.engine)
      }
    }
  }, [])

  return error ? (
    <ErrorBanner error={error} />
  ) : !viewState ? (
    <div>Loading...</div>
  ) : (
    <JBrowseLinearGenomeView viewState={viewState} />
  )
}
