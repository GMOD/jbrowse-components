import React from 'react'
import { observer } from 'mobx-react'
import Typography from '@material-ui/core/Typography'

export interface TrackBlurbProps {
  model: {
    sortedBy?: string
    sortedByRefName?: string
    sortedByPosition?: number
  }
}

function TrackBlurb(props: TrackBlurbProps) {
  const { model } = props
  return (
    <div
      data-testid={`blurb-${model.sortedBy}`}
      style={{ backgroundColor: 'white' }}
    >
      <Typography color="secondary" variant="caption">
        {model.sortedBy
          ? `Sorted by ${model.sortedBy.toLowerCase()} at ${
              model.sortedByRefName
            }:${model.sortedByPosition}`
          : null}
      </Typography>
    </div>
  )
}
export default observer(TrackBlurb)
