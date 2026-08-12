import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import {
  JBrowseApp,
  createViewState,
  destroyViewState,
} from '@jbrowse/react-app2'

type ViewState = ReturnType<typeof createViewState>

export default function WithLaunchLinearGenomeView() {
  const [viewState, setViewState] = useState<ViewState>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    // The engine is not owned by React, so unmounting alone leaves its RPC
    // worker threads and its autoruns running — see the external-plugin example
    // for why an engine built in an effect has to be destroyed by that effect.
    // One box rather than a `let`, because the cleanup below assigns from a
    // separate call and the compiler's narrowing doesn't see through that.
    const mount = { engine: undefined as ViewState | undefined }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const state = createViewState({
          config: {
            assemblies: [
              {
                name: 'GRCh38',
                aliases: ['hg38'],
                uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
                refNameAliases: {
                  uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
                },
              },
            ],
            tracks: [
              {
                type: 'QuantitativeTrack',
                trackId: 'hg38.100way.phyloP100way',
                name: 'hg38.100way.phyloP100way',
                category: ['Conservation'],
                assemblyNames: ['hg38'],
                adapter: {
                  type: 'BigWigAdapter',
                  uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
                },
              },
            ],
          },
        })
        const { pluginManager } = getEnv(state)

        mount.engine = state
        setViewState(state)
        // Strict so a bad assembly/loc reaches the catch below and renders the
        // error, instead of being swallowed into a silently blank view
        await pluginManager.evaluateAsyncExtensionPointStrict(
          'LaunchView-LinearGenomeView',
          {
            tracks: ['hg38.100way.phyloP100way'],
            loc: 'chr10:1-100000',
            assembly: 'hg38',
            session: state.session,
          },
        )
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
    return () => {
      if (mount.engine) {
        destroyViewState(mount.engine)
      }
    }
  }, [])

  return viewState ? (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseApp viewState={viewState} />
    </>
  ) : null
}
