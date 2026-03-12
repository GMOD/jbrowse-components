import { observer } from 'mobx-react'

import AlignmentConnections from './AlignmentConnections.tsx'
import Breakends from './Breakends.tsx'
import PairedFeatures from './PairedFeatures.tsx'
import Translocations from './Translocations.tsx'

import type { OverlayProps } from './overlayUtils.tsx'

const Overlay = observer(function Overlay(props: OverlayProps) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)
  const type = tracks[0]?.type

  if (tracks.some(t => t.displays[0]?.regionTooLarge)) {
    return null
  }

  if (type === 'AlignmentsTrack') {
    return <AlignmentConnections {...props} />
  }

  if (type === 'VariantTrack') {
    return model.hasTranslocations(trackId) ? (
      <Translocations {...props} />
    ) : model.hasPairedFeatures(trackId) ? (
      <PairedFeatures {...props} />
    ) : (
      <Breakends {...props} />
    )
  }

  return null
})

export default Overlay
