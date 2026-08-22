import { useEffect, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
  destroyViewState,
  loadPlugins,
} from '@jbrowse/react-linear-genome-view2'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

// Building the engine yourself means owning its lifetime: React unmounting this
// component does not stop the engine's RPC worker threads or its autoruns, so
// the effect below destroys whatever it built. That is not just tidiness —
// React StrictMode mounts, unmounts and mounts again in development, so without
// it every page visit leaves a whole worker pool behind.
export default function WithExternalPlugin() {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewModel>()

  useEffect(() => {
    // one box rather than two `let`s, because the cleanup below assigns from a
    // separate call and the compiler's narrowing doesn't see through that
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
        // the fetch can land after this effect was already torn down (in
        // StrictMode it usually does); building an engine now would leave one
        // that nothing destroys
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
          // pass the records through unchanged: each pairs the plugin class
          // with the definition it was loaded from, and that definition is what
          // lets the RPC worker load the same plugin on its side
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
