import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export default function WithLaunchLinearGenomeView() {
  const [viewState, setViewState] =
    useState<ReturnType<typeof createViewState>>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
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

        setViewState(state)
        await pluginManager.evaluateAsyncExtensionPoint(
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
  }, [])

  return viewState ? (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseApp viewState={viewState} />
    </>
  ) : null
}
