import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

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
  const { PileupDisplay, height, setScrollTop } = model
  const { classes } = useStyles()
  const pileupHeight = height

  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ position: 'relative', height }}
    >
      {/* Pileup track - scrollable container */}
      <div
        data-testid="Blockset-pileup"
        style={{
          position: 'absolute',
          top: 0,
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
