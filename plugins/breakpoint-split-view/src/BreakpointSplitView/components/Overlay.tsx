import React from 'react'
import { observer } from 'mobx-react'

// locals
import { BreakpointViewModel } from '../model'
import AlignmentConnections from './AlignmentConnections'
import Breakends from './Breakends'
import Translocations from './Translocations'

export default observer(function (props: {
  parentRef: React.RefObject<SVGSVGElement>
  model: BreakpointViewModel
  trackId: string
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)
  if (tracks[0]?.type === 'AlignmentsTrack') {
    return <AlignmentConnections {...props} />
  }
  if (tracks[0]?.type === 'VariantTrack') {
    return model.hasTranslocations(trackId) ? (
      <Translocations {...props} />
    ) : (
      <Breakends {...props} />
    )
  }
  return null
})
