import { useState } from 'react'

import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/react-linear-genome-view2'

const SearchPanel = observer(function SearchPanel({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const [query, setQuery] = useState('BRCA1')
  const debounced = useDebounce(query.trim(), 300)
  const {
    data: hits,
    error,
    isLoading,
  } = useFetch(debounced || null, (text: string, signal: AbortSignal) =>
    view.search(text, { signal }),
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
      {hits?.rows.length ? (
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
          {hits.rows.map(row => (
            <li key={row.id}>
              <button
                type="button"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => {
                  setQuery('')
                  void hits.pick(row.id)
                }}
              >
                <strong>{row.label}</strong> {row.location} {row.trackName}
              </button>
            </li>
          ))}
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
})

const SearchResults = observer(function SearchResults() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
      {
        trackId: 'genes',
        name: 'NCBI RefSeq genes',
        uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
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
  if (!state) {
    return null
  }
  return (
    <EmbedProvider session={state.session}>
      <div style={{ paddingBottom: 8 }}>
        <SearchPanel view={state.session.view} />
      </div>
      <TrackStack view={state.session.view} />
    </EmbedProvider>
  )
})

export default SearchResults
