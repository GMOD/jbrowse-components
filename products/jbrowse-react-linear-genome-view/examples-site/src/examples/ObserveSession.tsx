import { assembleLocString, isFeature } from '@jbrowse/core/util'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

function locOf(f: Feature) {
  return assembleLocString({
    refName: f.get('refName'),
    start: f.get('start'),
    end: f.get('end'),
  })
}

const SelectedFeature = observer(function SelectedFeature({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { selection } = viewState.session
  return isFeature(selection) ? (
    <p>
      Selected <b>{selection.get('name') || selection.id()}</b> at{' '}
      {locOf(selection)}
    </p>
  ) : (
    <p>Click a feature to select it.</p>
  )
})

const VisibleRegion = observer(function VisibleRegion({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { view } = viewState.session
  return view.initialized ? (
    <p>Visible region {view.coarseVisibleLocStrings}</p>
  ) : null
})

export default function ObserveSession() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    view: { loc: 'ctgA:1105..1221', tracks: ['volvox_gff3'] },
  })
  return state ? (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegion viewState={state} />
      <SelectedFeature viewState={state} />
    </div>
  ) : null
}
