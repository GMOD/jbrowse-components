import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-circular-genome-view2'

const TRACK_ID = 'volvox_sv_test'

const ToggleTrack = observer(function ToggleTrack({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { view } = viewState.session
  const open = view.tracks.some(t => t.configuration.trackId === TRACK_ID)
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
      {open ? 'Hide' : 'Show'} the structural variants
    </button>
  )
})

export default function ShowTrack() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: TRACK_ID,
        name: 'volvox structural variant test',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
      },
    ],
  })
  return state ? (
    <div>
      <ToggleTrack viewState={state} />
      <JBrowseCircularGenomeView viewState={state} />
    </div>
  ) : null
}
