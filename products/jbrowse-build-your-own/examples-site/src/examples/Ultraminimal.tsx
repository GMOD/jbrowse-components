import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const Ultraminimal = observer(function Ultraminimal() {
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
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 100, color: '#3a7ca5' },
      },
    ],
    configuration: { preferences: { scrollZoom: true } },
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  const { view } = session
  return (
    <EmbedProvider session={session}>
      <label>
        <input
          type="checkbox"
          checked={view.scrollZoom}
          onChange={() => {
            view.setScrollZoom(!view.scrollZoom)
          }}
        />
        Zoom on scroll
      </label>
      <TrackStack view={view} />
    </EmbedProvider>
  )
})

export default Ultraminimal
