import { getConf } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

const AlignmentsDisplay = observer(function AlignmentsDisplay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { PileupDisplay, height, setScrollTop } = model
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
