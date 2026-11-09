import {
  EmbedProvider,
  LocationBox,
  NavButton,
  Toolbar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const queries = ['chr13', 'gene15876', 'TP53', 'BRC', 'zzzznotagene']

const SearchByName = observer(function SearchByName() {
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
  const { view } = state.session
  return (
    <EmbedProvider session={state.session}>
      <Toolbar>
        <LocationBox view={view} />
        {queries.map(query => (
          <NavButton key={query} view={view} loc={query} />
        ))}
      </Toolbar>
      <TrackStack view={view} />
    </EmbedProvider>
  )
})

export default SearchByName
