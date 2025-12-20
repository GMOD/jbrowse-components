import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '../model'

const useStyles = makeStyles()(theme => ({
  resizeHandle: {
    height: 5,
    position: 'absolute',
    zIndex: 2,
    background: 'transparent',
    '&:hover': {
      background: theme.palette.divider,
    },
  },
}))

const AlignmentsDisplay = observer(function AlignmentsDisplay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { PileupDisplay, SNPCoverageDisplay, height, setScrollTop } = model
  const { classes } = useStyles()
  if (!SNPCoverageDisplay) {
    return null
  }
  const coverageHeight = SNPCoverageDisplay.height ?? 100
  const pileupHeight = height - coverageHeight

  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ position: 'relative', height }}
    >
      {/* Coverage track - fixed at top */}
      <div data-testid="Blockset-snpcoverage">
        <SNPCoverageDisplay.RenderingComponent model={SNPCoverageDisplay} />
      </div>
      <ResizeHandle
        onDrag={delta => {
          SNPCoverageDisplay.setHeight(SNPCoverageDisplay.height + delta)
          return delta
        }}
        className={classes.resizeHandle}
        style={{ top: coverageHeight - 4 }}
      />

      {/* Pileup track - scrollable container */}
      <div
        data-testid="Blockset-pileup"
        style={{
          position: 'absolute',
          top: coverageHeight,
          height: pileupHeight,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        onScroll={evt => {
          setScrollTop(evt.currentTarget.scrollTop)
        }}
      >
        <PileupDisplay.RenderingComponent model={PileupDisplay} />
      </div>
    </div>
  )
})

export default AlignmentsDisplay
