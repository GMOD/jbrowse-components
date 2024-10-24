import React from 'react'
import { observer } from 'mobx-react'

// locals
import { BreakpointViewModel } from '../model'
import AlignmentConnections from './AlignmentConnections'
import Breakends from './Breakends'
import Translocations from './Translocations'
import PairedFeatures from './PairedFeatures'

const Overlay = observer(function (props: {
  parentRef: React.RefObject<SVGSVGElement>
  model: BreakpointViewModel
  trackId: string
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)

  // curvy line type arcs
  if (tracks[0]?.type === 'AlignmentsTrack') {
    return <AlignmentConnections {...props} />
  }

  // translocation type arcs
  else if (tracks[0]?.type === 'VariantTrack') {
    return model.hasTranslocations(trackId) ? (
      <Translocations {...props} />
    ) : model.hasPairedFeatures(trackId) ? (
      <PairedFeatures {...props} />
    ) : (
      <Breakends {...props} />
    )
  } else {
    return null
  }
})

export default Overlay
