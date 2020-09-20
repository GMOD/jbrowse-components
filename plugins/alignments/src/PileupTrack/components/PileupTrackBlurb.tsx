import React from 'react'
import { observer } from 'mobx-react'
import Typography from '@material-ui/core/Typography'

interface TrackBlurbProps {
  model: {
    sortedBy?: {
      pos: number
      refName: number
      type: string
    }
  }
}

function TrackBlurb(props: TrackBlurbProps) {
  const { model } = props
  const { sortedBy } = model
  return sortedBy ? (
    <div
      data-testid={`blurb-${model.sortedBy}`}
      style={{ backgroundColor: 'white' }}
    >
      <Typography color="secondary" variant="caption">
        {model.sortedBy
          ? `Sorted by ${sortedBy.type.toLowerCase()} at ${sortedBy.refName}:${
              sortedBy.pos
            }`
          : null}
      </Typography>
    </div>
  ) : null
}
export default observer(TrackBlurb)
