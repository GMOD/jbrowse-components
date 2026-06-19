import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { JBrowseApp, createViewState, loadPlugins } from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

// loadPlugins fetches plugins at runtime from a URL (here the UCSC plugin from
// unpkg), so you don't have to bundle them. Pass the resulting classes to
// createViewState the same way you would inline plugins.
export default function WithExternalPlugin() {
  const [viewState, setViewState] = useState<ViewState>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const plugins = await loadPlugins([
          {
            name: 'UCSC',
            url: 'https://unpkg.com/jbrowse-plugin-ucsc@^1/dist/jbrowse-plugin-ucsc.umd.production.min.js',
          },
        ])
        const state = createViewState({
          config: {
            assemblies: [
              {
                name: 'hg19',
                aliases: ['GRCh37'],
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: 'Pd8Wh30ei9R',
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
                  init: {
                    assembly: 'hg19',
                    loc: '1:2,467,681..2,667,681',
                    tracks: ['segdups_ucsc_hg19'],
                  },
                },
              ],
            },
          },
          plugins: plugins.map(p => p.plugin),
        })
        setViewState(state)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])

  return error ? (
    <ErrorMessage error={error} />
  ) : viewState ? (
    <JBrowseApp viewState={viewState} />
  ) : null
}
