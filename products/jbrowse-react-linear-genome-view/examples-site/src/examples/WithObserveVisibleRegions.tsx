import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
]

function loc(r: BaseBlock) {
  return r.type === 'ContentBlock'
    ? `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
    : ''
}

type ViewState = ReturnType<typeof useCreateViewState>

const VisibleRegions = observer(function VisibleRegions({
  viewState,
}: {
  viewState: ViewState
}) {
  const view = viewState.session.view
  return view.initialized ? (
    <div>
      <p>
        Visible region{' '}
        {view.coarseDynamicBlocks.map(loc).filter(Boolean).join(',')}
      </p>
      <p>
        Static blocks{' '}
        {view.staticBlocks.contentBlocks
          .map(r => `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`)
          .join(',')}
      </p>
    </div>
  ) : null
})

export default function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
    </div>
  )
}
