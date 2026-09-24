import { useState } from 'react'

import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { fetchResults } from '@jbrowse/plugin-linear-genome-view'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

function SearchPanel({ session }: { session: ViewModel['session'] }) {
  const [query, setQuery] = useState('BRCA1')
  const debounced = useDebounce(query.trim(), 300)
  const { data, error, isLoading } = useFetch(
    debounced || null,
    async (queryString: string, signal: AbortSignal) =>
      fetchResults({
        queryString,
        signal,
        assemblyName: 'hg38',
        textSearchManager: session.textSearchManager,
        assembly: await session.assemblyManager.waitForAssembly('hg38'),
      }),
  )
  return (
    <div style={{ display: 'grid', gap: 4, width: 380, maxWidth: '100%' }}>
      <input
        aria-label="Search features"
        value={query}
        placeholder="BRCA1, TP53, chr17…"
        onChange={event => {
          setQuery(event.target.value)
        }}
      />
      {error ? (
        <span role="alert">
          {error instanceof Error ? error.message : String(error)}
        </span>
      ) : null}
      {data?.length ? (
        <ul
          data-testid="search-results"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: 132,
            overflowY: 'auto',
            fontSize: '0.8rem',
          }}
        >
          {data.map(result => {
            const location = result.getLocation()
            const trackId = result.getTrackId()
            return (
              <li key={result.getId()}>
                <button
                  type="button"
                  disabled={!location}
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => {
                    const { view } = session
                    if (location) {
                      setQuery('')
                      view
                        .navToLocString(location, 'hg38', 0.2)
                        .then(() =>
                          trackId ? view.launchTrack(trackId) : undefined,
                        )
                        .catch((e: unknown) => {
                          console.error(e)
                        })
                    }
                  }}
                >
                  <strong>{result.getDisplayString()}</strong> {location}{' '}
                  {trackId}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          {!debounced
            ? 'Type a feature or contig name'
            : isLoading || debounced !== query.trim()
              ? 'Searching…'
              : `Nothing matches “${debounced}”`}
        </span>
      )}
    </div>
  )
}

const SearchResultsDropdown = observer(function SearchResultsDropdown() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
    tracks: [
      {
        trackId: 'genes',
        name: 'NCBI RefSeq genes',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        displayDefaults: { height: 140 },
      },
    ],
    aggregateTextSearchAdapters: [
      'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
    ],
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['genes'],
    },
  })
  return state ? (
    <EmbedProvider session={state.session}>
      <div style={{ paddingBottom: 8 }}>
        <SearchPanel session={state.session} />
      </div>
      <TrackStack view={state.session.view} />
    </EmbedProvider>
  ) : null
})

export default SearchResultsDropdown
