import { useEffect, useRef, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { JBrowseApp, useCreateViewState } from '@jbrowse/react-app2'

const config = {
  assemblies: [
    {
      name: 'GRCh38',
      aliases: ['hg38'],
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
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
}

export default function WithLaunchLinearGenomeView() {
  const viewState = useCreateViewState({ config })
  const launched = useRef(false)
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    if (viewState && !launched.current) {
      launched.current = true
      getEnv(viewState)
        .pluginManager.evaluateAsyncExtensionPointStrict(
          'LaunchView-LinearGenomeView',
          {
            tracks: ['hg38.100way.phyloP100way'],
            loc: 'chr10:1-100000',
            assembly: 'hg38',
            session: viewState.session,
          },
        )
        .catch((e: unknown) => {
          console.error(e)
          setError(e)
        })
    }
  }, [viewState])

  return viewState ? (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <JBrowseApp viewState={viewState} />
    </>
  ) : null
}
