import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  JBrowseApp,
  createViewState,
  destroyViewState,
  loadPlugins,
} from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

// loadPlugins fetches plugins at runtime from a URL (here the UCSC plugin from
// unpkg), so you don't have to bundle them. Pass the records it returns to
// createViewState unchanged — each one pairs the plugin class with the
// definition it was loaded from, and that definition is what lets the RPC
// worker load the same plugin on its side.
//
// Building the engine yourself means owning its lifetime: React unmounting this
// component does not stop the engine's RPC worker threads or its autoruns, so
// the effect below destroys whatever it built. That is not just tidiness —
// React StrictMode mounts, unmounts and mounts again in development, so without
// it every page visit leaves a whole worker pool behind.
export default function WithExternalPlugin() {
  const [viewState, setViewState] = useState<ViewState>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // one box rather than two `let`s, because the cleanup below assigns from a
    // separate call and the compiler's narrowing doesn't see through that
    const mount = {
      unmounted: false,
      engine: undefined as ViewState | undefined,
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
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
        mount.engine = createViewState({
          config: {
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
          },
          plugins,
        })
        setViewState(mount.engine)
      } catch (e) {
        console.error(e)
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
    <ErrorMessage error={error} />
  ) : viewState ? (
    <JBrowseApp viewState={viewState} />
  ) : null
}
