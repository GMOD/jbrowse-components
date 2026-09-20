import {
  EmbedProvider,
  TrackStack,
  useLocationBox,
} from '@jbrowse/display-ui/embed'
import { SearchResultsNotFoundError } from '@jbrowse/plugin-linear-genome-view'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const queries = ['chr13', 'gene15876', 'TP53', 'BRC', 'zzzznotagene']

const SearchBox = observer(function SearchBox({
  session,
}: {
  session: ViewModel['session']
}) {
  const box = useLocationBox(session.view)
  const queued = session.queueOfDialogs.length
  return (
    <div style={{ display: 'grid', gap: 6, paddingBottom: 8 }}>
      <form
        onSubmit={event => {
          event.preventDefault()
          box.go()
        }}
      >
        <input
          aria-label="Search by name or location"
          value={box.value}
          size={28}
          onChange={event => {
            box.edit(event.target.value)
          }}
        />
        <button type="submit">{box.pending ? 'Searching…' : 'Go'}</button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {queries.map(query => (
          <button
            key={query}
            type="button"
            onClick={() => {
              box.go(query)
            }}
          >
            {query}
          </button>
        ))}
      </div>
      {box.error instanceof SearchResultsNotFoundError ? (
        <span role="status">{box.error.message}</span>
      ) : box.error ? (
        <span role="alert">
          {box.error instanceof Error ? box.error.message : String(box.error)}
        </span>
      ) : null}
      {queued ? (
        <div role="status" data-testid="queued-dialog-notice">
          {queued} dialog{queued > 1 ? 's' : ''} queued, and this page renders
          none.{' '}
          <button
            type="button"
            onClick={() => {
              session.removeActiveDialog()
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
})

const SearchByName = observer(function SearchByName() {
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
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'hg38-index',
        assemblyNames: ['hg38'],
        ixFilePath: {
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix',
        },
        ixxFilePath: {
          uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx',
        },
      },
    ],
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['genes'],
    },
  })
  return state ? (
    <EmbedProvider session={state.session}>
      <SearchBox session={state.session} />
      <TrackStack view={state.session.view} />
    </EmbedProvider>
  ) : null
})

export default SearchByName
