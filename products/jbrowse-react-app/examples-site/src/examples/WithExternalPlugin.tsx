import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  JBrowseApp,
  createViewState,
  destroyViewState,
  loadPlugins,
} from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

export default function WithExternalPlugin() {
  const [viewState, setViewState] = useState<ViewState>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    const mount = {
      unmounted: false,
      engine: undefined as ViewState | undefined,
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
