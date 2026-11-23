import { getTrackName } from '@jbrowse/core/util'
import { offeredTracks } from '@jbrowse/core/util/tracks'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const TrackList = observer(function TrackList({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { session } = viewState
  const { view } = session
  const tracks = offeredTracks(session.tracks, {
    view,
    assemblyNames: view.assemblyNames,
  })
  return (
    <fieldset>
      <legend>Tracks</legend>
      {tracks.map(conf => (
        <label key={conf.trackId} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={!!view.getTrack(conf.trackId)}
            onChange={() => {
              view.toggleTrack(conf.trackId)
            }}
          />{' '}
          {getTrackName(conf, session)}
        </label>
      ))}
    </fieldset>
  )
})

export default function TrackListExample() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'genes',
        name: 'Genes',
        uri: `${base}/volvox.sort.gff3.gz`,
      },
      {
        trackId: 'reads',
        name: 'Reads',
        uri: `${base}/volvox-sorted.bam`,
      },
      {
        trackId: 'coverage',
        name: 'Microarray signal',
        uri: `${base}/volvox_microarray.bw`,
      },
      {
        trackId: 'variants',
        name: 'Variants',
        uri: `${base}/volvox.filtered.vcf.gz`,
      },
    ],
    view: { loc: 'ctgA:1..6000', tracks: ['genes'] },
  })
  return state ? (
    <div>
      <TrackList viewState={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  ) : null
}
