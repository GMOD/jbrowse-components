import {
  EmbedProvider,
  LocationBox,
  TrackStack,
  TrackToggle,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const hubTracks = [
  { id: 'hg38-ncbiRefSeqCurated', label: 'RefSeq genes' },
  { id: 'hg38-cpgIslandExt', label: 'CpG islands' },
  { id: 'my_phylop', label: 'My own file' },
]

const GenomeByName = observer(function GenomeByName() {
  const state = useCreateViewState({
    jbrowseHub: 'hg38',
    tracks: [
      {
        trackId: 'my_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 80, color: '#3a7ca5' },
      },
    ],
    view: {
      loc: 'BRCA1',
      tracks: ['my_phylop', 'hg38-ncbiRefSeqCurated'],
    },
  })
  if (!state) {
    return null
  }
  const { view } = state.session
  return (
    <EmbedProvider session={state.session}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 8,
          fontSize: '0.85rem',
        }}
      >
        <LocationBox view={view} />
        {hubTracks.map(({ id, label }) => (
          <TrackToggle key={id} view={view} trackId={id}>
            {label}
          </TrackToggle>
        ))}
      </div>
      <TrackStack view={view} />
    </EmbedProvider>
  )
})

export default GenomeByName
