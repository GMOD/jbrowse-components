import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useEffect } from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import AlignmentsBlockBasedTrack from './AlignmentsBlockBasedTrack'

interface AlignmentsTrackProps {
  blockState: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
  offsetPx: number
  bpPerPx: number
  onHorizontalScroll: Function
}

function AlignmentsTrackComponent(props: AlignmentsTrackProps) {
  const { model } = props
  const {
    PileupTrack,
    SNPCoverageTrack,
    height,
    showPileup,
    showCoverage,
  } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  // determine height of the model when toggling pileuptrack
  useEffect(() => {
    SNPCoverageTrack.setHeight(!showPileup ? model.height : 40)
  }, [SNPCoverageTrack, model, showPileup])

  return (
    <div style={{ position: 'relative' }}>
      <AlignmentsBlockBasedTrack
        {...props}
        {...PileupTrack}
        {...SNPCoverageTrack}
        showPileup={showPileup}
        showSNPCoverage={showCoverage}
      >
        {showScalebar && showCoverage ? (
          <YScaleBar model={SNPCoverageTrack} />
        ) : null}
      </AlignmentsBlockBasedTrack>
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
