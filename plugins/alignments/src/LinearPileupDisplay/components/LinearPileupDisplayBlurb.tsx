import React from 'react'
import { observer } from 'mobx-react'
import { Typography } from '@mui/material'

export interface LinearPileupDisplayBlurbProps {
  model: {
    sortedBy?: {
      pos: number
      refName: number
      type: string
      tag?: string
    }
  }
}

export default observer(function LinearPileupDisplayBlurb(
  props: LinearPileupDisplayBlurbProps,
) {
  const { model } = props
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
