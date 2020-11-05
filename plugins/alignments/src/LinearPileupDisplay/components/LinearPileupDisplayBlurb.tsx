import React from 'react'
import { observer } from 'mobx-react'
import Typography from '@material-ui/core/Typography'

export interface LinearPileupDisplayBlurbProps {
  model: {
    sortedBy?: {
      pos: number
      refName: number
      type: string
    }
  }
}

function LinearPileupDisplayBlurb(props: LinearPileupDisplayBlurbProps) {
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
export default observer(LinearPileupDisplayBlurb)
