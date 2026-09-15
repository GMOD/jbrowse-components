import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const OneTrack = observer(function OneTrack() {
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
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
        displayDefaults: { height: 100, color: '#3a7ca5' },
      },
    ],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop'],
    },
  })
  return state ? (
    <SessionPaletteProvider session={state.session}>
      <TrackStack view={state.session.view} />
    </SessionPaletteProvider>
  ) : null
})

export default OneTrack
