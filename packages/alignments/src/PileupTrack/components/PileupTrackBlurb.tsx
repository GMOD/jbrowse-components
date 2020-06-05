import React from 'react'
import { observer } from 'mobx-react'
import Typography from '@material-ui/core/Typography'
import { PileupTrackModel } from '../model'

function TrackBlurb(props: { model: PileupTrackModel }) {
  const { model } = props
  return (
    <div style={{ backgroundColor: 'white' }}>
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
