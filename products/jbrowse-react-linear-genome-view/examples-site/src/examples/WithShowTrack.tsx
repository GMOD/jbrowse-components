import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const TRACK_ID = 'volvox_gff3'

// `view.tracks` is observable, so an `observer` button knows whether the track
// is open without subscribing to anything — no callback, no local copy of the
// state that can fall out of step with the track selector's own checkbox.
const ToggleTrack = observer(function ToggleTrack({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { view } = viewState.session
  const open = !!view.getTrack(TRACK_ID)
  return (
    <button
      onClick={() => {
        // launchTrack API: https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-launchtrack
        if (open) {
          view.hideTrack(TRACK_ID)
        } else {
          void view.launchTrack(TRACK_ID)
        }
      }}
    >
      {open ? 'Hide' : 'Show'} the genes track
    </button>
  )
})

export default function WithShowTrack() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: TRACK_ID,
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    // the view opens with the track closed, since this page is about opening it
    // from your own code. For a track that should be open on first paint, put
    // its id in `init.tracks` instead of calling showTrack at construction
    init: { loc: 'ctgA:1105..1221' },
  })
  return (
    <div>
      <ToggleTrack viewState={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
