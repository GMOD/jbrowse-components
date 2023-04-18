import React, { useEffect, useState } from 'react'
// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import {
  createViewState,
  loadPlugins,
  JBrowseLinearGenomeView,
} from '../../src'

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
        locationType: 'UriLocation',
      },
    },
  },
}

type ViewState = ReturnType<typeof createViewState>

export const WithExternalPlugin = () => {
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewState>()

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
          assembly: hg19Assembly,
          plugins: plugins.map(p => p.plugin),
          tracks: [
            {
              type: 'FeatureTrack',
              trackId: 'segdups_ucsc_hg19',
              name: 'UCSC SegDups',
              category: ['Annotation'],
              assemblyNames: ['hg19'],
              adapter: {
                type: 'UCSCAdapter',
                track: 'genomicSuperDups',
              },
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

  return (
    <div>
      {error ? (
        <div style={{ color: 'red' }}>{`${error}`}</div>
      ) : !viewState ? (
        <div>Loading...</div>
      ) : (
        <JBrowseLinearGenomeView viewState={viewState} />
      )}
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithExternalPlugin.tsx">
        Source code
      </a>
    </div>
  )
}
