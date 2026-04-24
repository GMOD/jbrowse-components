import { observer } from 'mobx-react'

import AlignmentConnections from './AlignmentConnections.tsx'
import Breakends from './Breakends.tsx'
import PairedFeatures from './PairedFeatures.tsx'
import Translocations from './Translocations.tsx'

import type { OverlayProps } from './overlayUtils.tsx'

const Overlay = observer(function Overlay(props: OverlayProps) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)
  if (tracks.some(t => t.displays[0]?.regionTooLarge)) {
    return null
  }
  const kind = model.overlayMatches.get(trackId)?.kind
  if (kind === 'alignment') {
    return <AlignmentConnections {...props} />
  }
  if (kind === 'translocation') {
    return <Translocations {...props} />
  }
  if (kind === 'paired') {
    return <PairedFeatures {...props} />
  }
  if (kind === 'breakend') {
    return <Breakends {...props} />
  }
  return null
})

export default Overlay
