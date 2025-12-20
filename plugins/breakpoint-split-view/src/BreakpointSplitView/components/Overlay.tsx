import { observer } from 'mobx-react'

import AlignmentConnections from './AlignmentConnections'
import Breakends from './Breakends'
import PairedFeatures from './PairedFeatures'
import Translocations from './Translocations'

import type { BreakpointViewModel } from '../model'

// Routes to the appropriate overlay component based on track type:
//
// - AlignmentsTrack (BAM/CRAM): renders split read / paired-end connections
//   using AlignmentConnections (curvy bezier arcs)
//
// - VariantTrack (VCF): renders structural variant connections using one of:
//   - Translocations: for TRA type variants (uses INFO.CHR2, INFO.END)
//   - PairedFeatures: for paired_feature type (e.g. BEDPE-style)
//   - Breakends: for BND type variants (uses ALT field breakend notation)
const Overlay = observer(function (props: {
  parentRef: React.RefObject<SVGSVGElement | null>
  model: BreakpointViewModel
  trackId: string
  getTrackYPosOverride?: (trackId: string, level: number) => number
}) {
  const { model, trackId } = props
  const tracks = model.getMatchedTracks(trackId)
  const type = tracks[0]?.type

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
