import { observer } from 'mobx-react'

import AlignmentConnections from './AlignmentConnections'
import Breakends from './Breakends'
import PairedFeatures from './PairedFeatures'
import Translocations from './Translocations'

import type { BreakpointViewModel } from '../model'

const Overlay = observer(function (props: {
  parentRef: React.RefObject<SVGSVGElement | null>
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
