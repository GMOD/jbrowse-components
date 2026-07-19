import { isFeature } from '@jbrowse/core/util'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

type ViewState = ReturnType<typeof useCreateViewState>

// session.selection is set to a Feature whenever the user clicks one (the same
// path that opens the feature-details widget). An observer re-renders when it
// changes, so a companion panel stays in sync with no click handler wiring.
const SelectedFeature = observer(function SelectedFeature({
  viewState,
}: {
  viewState: ViewState
}) {
  const { selection } = viewState.session
  return isFeature(selection) ? (
    <p>
      Selected <b>{selection.get('name') || selection.id()}</b> at{' '}
      {selection.get('refName')}:{selection.get('start')}-
      {selection.get('end')}
    </p>
  ) : (
    <p>Click a feature to select it.</p>
  )
})

export default function ObserveSelection() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    defaultSession: {
      name: 'Observe selection',
      view: {
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1..50,000',
          tracks: ['volvox_gff3'],
        },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <SelectedFeature viewState={state} />
    </div>
  )
}
