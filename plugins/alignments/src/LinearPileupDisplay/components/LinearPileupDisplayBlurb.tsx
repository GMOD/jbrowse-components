import React from 'react'
import { observer } from 'mobx-react'
import { Typography } from '@mui/material'

const LinearPileupDisplayBlurb = observer(function ({
  model,
}: {
  model: {
    sortedBy?: {
      pos: number
      refName: number
      type: string
      tag?: string
    }
  }
}) {
  const { sortedBy } = model
  return sortedBy ? (
    <div data-testid={`blurb-${sortedBy}`}>
      <Typography color="secondary" variant="caption">
        {sortedBy
          ? `Sorted by ${sortedBy.tag ?? sortedBy.type} at ${
              sortedBy.refName
            }:${sortedBy.pos}`
          : null}
      </Typography>
    </div>
  ) : null
})

export default LinearPileupDisplayBlurb
