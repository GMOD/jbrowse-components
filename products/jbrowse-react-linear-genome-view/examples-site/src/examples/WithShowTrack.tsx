import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const TRACK_ID = 'volvox_gff3'

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
        trackId: TRACK_ID,
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    view: { loc: 'ctgA:1105..1221' },
  })
  return state ? (
    <div>
      <ToggleTrack viewState={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  ) : null
}
