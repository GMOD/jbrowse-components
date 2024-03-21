import React, { useEffect, useState } from 'react'
// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import {
  createViewState,
  loadPlugins,
  JBrowseLinearGenomeView,
} from '../../src'

const hg19Assembly = {
  aliases: ['GRCh37'],
  name: 'hg19',
  refNameAliases: {
    adapter: {
      location: {
        locationType: 'UriLocation',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
      },
      type: 'RefNameAliasAdapter',
    },
  },
  sequence: {
    adapter: {
      faiLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
      },
      fastaLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
      },
      gziLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
      },
      type: 'BgzipFastaAdapter',
    },
    trackId: 'Pd8Wh30ei9R',
    type: 'ReferenceSequenceTrack',
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
          location: '1:2,467,681..2,667,681',
          plugins: plugins.map(p => p.plugin),
          tracks: [
            {
              adapter: {
                track: 'genomicSuperDups',
                type: 'UCSCAdapter',
              },
              assemblyNames: ['hg19'],
              category: ['Annotation'],
              name: 'UCSC SegDups',
              trackId: 'segdups_ucsc_hg19',
              type: 'FeatureTrack',
            },
          ],
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
